// socialLookup.js
import axios from 'axios';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import randomUseragent from 'random-useragent';
import cheerio from 'cheerio';
import { proxies } from './proxies'; // Import proxy list

// Initialize stealth plugin
puppeteer.use(StealthPlugin());

// Enhanced Proxy Manager
class ProxyManager {
  constructor() {
    this.proxies = proxies;
    this.workingProxies = [];
    this.currentProxyIndex = 0;
    this.testUrl = 'https://httpbin.org/ip';
    this.blacklistedProxies = new Set();
  }

  async initialize() {
    await this.testProxies();
    if (this.workingProxies.length === 0) {
      console.warn('No working proxies found - proceeding without proxies');
    }
  }

  async testProxies() {
    console.log('Testing proxies...');
    const testPromises = this.proxies
      .filter(proxy => !this.blacklistedProxies.has(proxy))
      .map(proxy => this.testProxy(proxy));
    
    const results = await Promise.all(testPromises);
    this.workingProxies = results.filter(Boolean);
    console.log(`Found ${this.workingProxies.length} working proxies`);
  }

  async testProxy(proxy) {
    try {
      const agent = new HttpsProxyAgent(`http://${proxy}`);
      const response = await axios.get(this.testUrl, {
        httpsAgent: agent,
        timeout: 5000
      });
      console.log(`Proxy ${proxy} works (IP: ${response.data.origin})`);
      return proxy;
    } catch (error) {
      console.log(`Proxy ${proxy} failed: ${error.message}`);
      this.blacklistedProxies.add(proxy);
      return null;
    }
  }

  getNextProxy() {
    if (this.workingProxies.length === 0) return null;
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.workingProxies.length;
    return this.workingProxies[this.currentProxyIndex];
  }

  getProxyAgent() {
    const proxy = this.getNextProxy();
    return proxy ? new HttpsProxyAgent(`http://${proxy}`) : null;
  }

  getPuppeteerProxyArgs() {
    const proxy = this.getNextProxy();
    if (!proxy) return [];
    
    const [host, port] = proxy.split(':');
    return [
      `--proxy-server=${host}:${port}`,
      '--proxy-bypass-list=<-loopback>'
    ];
  }
}

// Initialize proxy manager
const proxyManager = new ProxyManager();

// CAPTCHA Handling
class CaptchaSolver {
  constructor() {
    this.apiKey = process.env.CAPTCHA_API_KEY || 'YOUR_2CAPTCHA_API_KEY';
    this.fallbackEnabled = true;
  }

  async solve(page) {
    try {
      // Try 2Captcha first if API key exists
      if (this.apiKey && this.apiKey !== 'YOUR_2CAPTCHA_API_KEY') {
        return await this.solveWith2Captcha(page);
      }
      
      // Fallback to manual solving
      if (this.fallbackEnabled) {
        return await this.fallbackSolve(page);
      }
      
      throw new Error('No CAPTCHA solving method available');
    } catch (error) {
      console.error('CAPTCHA solving failed:', error.message);
      throw error;
    }
  }

  async solveWith2Captcha(page) {
    const sitekey = await page.$eval('.g-recaptcha', el => el.dataset.sitekey);
    const pageUrl = page.url();
    
    const submitResponse = await axios.post('https://2captcha.com/in.php', {
      key: this.apiKey,
      method: 'userrecaptcha',
      googlekey: sitekey,
      pageurl: pageUrl,
      json: 1
    }, { timeout: 10000 });
    
    if (!submitResponse.data.status) {
      throw new Error(submitResponse.data.request || 'Failed to submit CAPTCHA');
    }
    
    const captchaId = submitResponse.data.request;
    let solution = null;
    const startTime = Date.now();
    
    while (Date.now() - startTime < 120000) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const response = await axios.get('https://2captcha.com/res.php', {
        params: {
          key: this.apiKey,
          action: 'get',
          id: captchaId,
          json: 1
        },
        timeout: 10000
      });
      
      if (response.data.status === 1) {
        solution = response.data.request;
        break;
      }
      
      if (response.data.request !== 'CAPCHA_NOT_READY') {
        throw new Error(response.data.request || 'CAPTCHA solving failed');
      }
    }
    
    if (!solution) throw new Error('CAPTCHA solving timed out');
    
    await page.evaluate((solution) => {
      document.getElementById('g-recaptcha-response').innerText = solution;
      const event = new Event('change', { bubbles: true });
      document.getElementById('g-recaptcha-response').dispatchEvent(event);
    }, solution);
    
    return solution;
  }

  async fallbackSolve(page) {
    console.warn('Using fallback CAPTCHA solving method...');
    // Implement your fallback CAPTCHA solving logic here
    // This could include:
    // 1. Prompting for manual solving
    // 2. Using OCR libraries for image CAPTCHAs
    // 3. Alternative CAPTCHA solving services
    
    // Example: Wait for manual solving
    await page.evaluate(() => {
      alert('Please solve the CAPTCHA and click OK to continue');
    });
    
    // Wait for navigation after CAPTCHA is presumably solved
    await page.waitForNavigation({ timeout: 300000 }); // 5 minute timeout
    
    return 'manual-fallback';
  }
}

const captchaSolver = new CaptchaSolver();

/**
 * Main lookup function with enhanced capabilities
 */
export const lookupSocialMedia = async (name, options = {}) => {
  // Initialize proxy manager
  await proxyManager.initialize();
  
  const socialProfiles = {};
  const searchQuery = encodeURIComponent(name);

  try {
    // ===== METHOD 1: Multi-Search Engine Scraping =====
    const [googleResults, bingResults] = await Promise.all([
      scrapeGoogle(searchQuery),
      scrapeBing(searchQuery).catch(() => ({}))
    ]);
    
    Object.assign(socialProfiles, googleResults, bingResults);

    // ===== METHOD 2: Reverse Image Search =====
    if (options.useImageSearch && options.imageUrl) {
      try {
        const imageResults = await reverseImageSearch(options.imageUrl);
        Object.assign(socialProfiles, imageResults);
      } catch (e) {
        console.warn('Reverse image search failed:', e.message);
      }
    }

    // ===== METHOD 3: Direct Platform Searches =====
    const platformSearches = [];
    
    if (!socialProfiles.facebook) {
      platformSearches.push(
        searchFacebook(name).then(url => url && (socialProfiles.facebook = url))
      );
    }
    
    if (!socialProfiles.instagram) {
      platformSearches.push(
        searchInstagram(name).then(url => url && (socialProfiles.instagram = url))
      );
    }
    
    if (!socialProfiles.linkedin) {
      platformSearches.push(
        searchLinkedIn(name).then(url => url && (socialProfiles.linkedin = url))
      );
    }
    
    if (!socialProfiles.twitter) {
      platformSearches.push(
        searchTwitter(name).then(url => url && (socialProfiles.twitter = url))
      );
    }

    await Promise.all(platformSearches);

    // ===== METHOD 4: Username Consistency Check =====
    if (options.includeUsernameCheck !== false && socialProfiles.instagram) {
      try {
        const username = socialProfiles.instagram.split('/').pop();
        const usernameResults = await checkUsername(username);
        Object.assign(socialProfiles, usernameResults);
      } catch (e) {
        console.warn('Username check failed:', e.message);
      }
    }

    return socialProfiles;
  } catch (error) {
    console.error('Enhanced lookup error:', error);
    return {};
  }
};

// [Rest of your helper functions (scrapeGoogle, searchLinkedIn, etc.) remain the same]
// Just make sure to use proxyManager.getPuppeteerProxyArgs() and proxyManager.getProxyAgent()
// instead of the standalone functions

export default lookupSocialMedia;