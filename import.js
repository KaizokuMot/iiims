import axios from 'axios';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import randomUseragent from 'random-useragent';
import cheerio from 'cheerio';

// Enable stealth mode to avoid bot detection
puppeteer.use(StealthPlugin());

// Proxy rotation (optional but recommended)
const proxies = [
  'http://user:pass@proxy1:port',
  'http://user:pass@proxy2:port',
];

const getRandomProxy = () => proxies[Math.floor(Math.random() * proxies.length)];

// CAPTCHA solver configuration (optional)
const CAPTCHA_API_KEY = 'YOUR_2CAPTCHA_API_KEY'; // Replace with actual key

/**
 * Main lookup function - now with enhanced capabilities
 * @param {string} name - Person's name to search
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.useImageSearch=false] - Enable reverse image search
 * @param {string} [options.imageUrl] - URL of profile picture for image search
 * @returns {Promise<{facebook?: string, instagram?: string, twitter?: string, linkedin?: string, github?: string, reddit?: string}>}
 */
export const lookupSocialMedia = async (name, options = {}) => {
  const socialProfiles = {};
  const searchQuery = encodeURIComponent(name);

  try {
    // ===== METHOD 1: Multi-Search Engine Scraping =====
    const [googleResults, bingResults] = await Promise.all([
      scrapeGoogle(searchQuery),
      scrapeBing(searchQuery)
    ]);
    
    Object.assign(socialProfiles, googleResults, bingResults);

    // ===== METHOD 2: Reverse Image Search (Optional) =====
    if (options.useImageSearch && options.imageUrl) {
      const imageResults = await reverseImageSearch(options.imageUrl);
      Object.assign(socialProfiles, imageResults);
    }

    // ===== METHOD 3: Direct Platform Searches (Fallback) =====
    const platformSearches = [];
    
    if (!socialProfiles.facebook) {
      platformSearches.push(
        searchFacebook(name).then(url => { if (url) socialProfiles.facebook = url; })
      );
    }
    
    if (!socialProfiles.instagram) {
      platformSearches.push(
        searchInstagram(name).then(url => { if (url) socialProfiles.instagram = url; })
      );
    }
    
    if (!socialProfiles.linkedin) {
      platformSearches.push(
        searchLinkedIn(name).then(url => { if (url) socialProfiles.linkedin = url; })
      );
    }
    
    if (!socialProfiles.twitter) {
      platformSearches.push(
        searchTwitter(name).then(url => { if (url) socialProfiles.twitter = url; })
      );
    }

    await Promise.all(platformSearches);

    // ===== METHOD 4: Username Consistency Check =====
    // Try finding matching usernames across platforms
    if (socialProfiles.instagram) {
      const username = socialProfiles.instagram.split('/').pop();
      const usernameResults = await checkUsername(username);
      Object.assign(socialProfiles, usernameResults);
    }

    return socialProfiles;
  } catch (error) {
    console.error('Enhanced lookup error:', error);
    return {};
  }
};

// ===== Helper Functions =====

/** Scrape Google for social profiles with improved reliability */
async function scrapeGoogle(query) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--proxy-server=${getRandomProxy()}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.goto(`https://www.google.com/search?q=${query}+site:facebook.com+OR+site:instagram.com+OR+site:linkedin.com+OR+site:twitter.com`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Check for CAPTCHA
    if (await page.$('#captcha-form')) {
      if (CAPTCHA_API_KEY) {
        await solveCaptcha(page);
        await page.waitForNavigation();
      } else {
        console.warn('CAPTCHA detected but no solver configured');
      }
    }

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="http"]'));
      const results = {};
      const domains = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com'];

      links.forEach(link => {
        try {
          const url = new URL(link.href);
          const domain = url.hostname.replace('www.', '');
          
          if (domains.some(d => domain.includes(d))) {
            const platform = domain.split('.')[0];
            if (!results[platform]) {
              results[platform] = url.toString();
            }
          }
        } catch (e) {
          // Invalid URL, skip
        }
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}

/** Scrape Bing as alternative search engine */
async function scrapeBing(query) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    
    await page.goto(`https://www.bing.com/search?q=${query}+site:facebook.com+OR+site:instagram.com+OR+site:linkedin.com`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="http"]'));
      const results = {};

      links.forEach(link => {
        const url = link.href;
        if (url.includes('facebook.com')) results.facebook = url;
        else if (url.includes('instagram.com')) results.instagram = url;
        else if (url.includes('linkedin.com')) results.linkedin = url;
        else if (url.includes('twitter.com')) results.twitter = url;
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}

/** Reverse image search for profile matching */
async function reverseImageSearch(imageUrl) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    
    await page.goto(`https://images.google.com/searchbyimage?image_url=${encodeURIComponent(imageUrl)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const profiles = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="linkedin.com"]'));
      const results = {};

      links.forEach(link => {
        const url = link.href;
        if (url.includes('facebook.com')) results.facebook = url;
        else if (url.includes('instagram.com')) results.instagram = url;
        else if (url.includes('linkedin.com')) results.linkedin = url;
      });

      return results;
    });

    return profiles;
  } finally {
    await browser.close();
  }
}

/** Search LinkedIn with improved reliability */
async function searchLinkedIn(name) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    
    await page.goto(`https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(name)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const profileUrl = await page.evaluate(() => {
      const firstResult = document.querySelector('a[href*="linkedin.com/in/"]');
      return firstResult ? firstResult.href : null;
    });

    return profileUrl;
  } finally {
    await browser.close();
  }
}

/** Search Twitter via Nitter to avoid API limits */
async function searchTwitter(name) {
  try {
    const response = await resilientRequest(`https://nitter.net/search?q=${encodeURIComponent(name)}`);
    const $ = cheerio.load(response);
    const profileLink = $('a.username').first().attr('href');
    return profileLink ? `https://twitter.com${profileLink}` : null;
  } catch (error) {
    console.warn('Twitter search failed:', error);
    return null;
  }
}

/** Search Facebook with improved reliability */
async function searchFacebook(name) {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [`--proxy-server=${getRandomProxy()}`]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUseragent.getRandom());
    
    await page.goto(`https://www.facebook.com/public/${encodeURIComponent(name)}`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const profile = await page.evaluate(() => {
      const firstResult = document.querySelector('a[href*="/profile.php?id="], a[href*="/username"]');
      return firstResult ? firstResult.href : null;
    });

    return profile;
  } finally {
    await browser.close();
  }
}

/** Search Instagram with fallback methods */
async function searchInstagram(name) {
  try {
    // Try official API first
    const response = await resilientRequest(`https://www.instagram.com/web/search/topsearch/?query=${name}`);
    const user = response.data.users?.find(u => 
      u.user.username.includes(name.toLowerCase()) || 
      u.user.full_name?.toLowerCase().includes(name.toLowerCase())
    );
    
    if (user) return `https://instagram.com/${user.user.username}`;
    
    // Fallback to Google search
    const browser = await puppeteer.launch({ headless: "new" });
    try {
      const page = await browser.newPage();
      await page.goto(`https://www.google.com/search?q=site:instagram.com+${encodeURIComponent(name)}`);
      
      const instagramUrl = await page.evaluate(() => {
        const link = document.querySelector('a[href*="instagram.com/"]');
        return link ? link.href : null;
      });
      
      return instagramUrl;
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn('Instagram search failed:', error);
    return null;
  }
}

/** Check username across multiple platforms */
async function checkUsername(username) {
  const sites = [
    { name: 'github', url: `https://github.com/${username}` },
    { name: 'reddit', url: `https://www.reddit.com/user/${username}` },
    { name: 'tiktok', url: `https://www.tiktok.com/@${username}` }
  ];
  
  const results = {};
  
  await Promise.all(sites.map(async (site) => {
    try {
      const response = await axios.head(site.url, { timeout: 5000 });
      if (response.status === 200) results[site.name] = site.url;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Username not found - expected case
      } else {
        console.warn(`Username check failed for ${site.name}:`, error.message);
      }
    }
  }));
  
  return results;
}

/** Resilient request with retries and timeouts */
async function resilientRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': randomUseragent.getRandom(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

/** CAPTCHA solver integration */
async function solveCaptcha(page) {
  try {
    const sitekey = await page.$eval('.g-recaptcha', el => el.dataset.sitekey);
    const { solution } = await solver.recaptcha(sitekey, page.url());
    await page.evaluate((solution) => {
      document.getElementById('g-recaptcha-response').innerHTML = solution;
      const event = new Event('change', { bubbles: true });
      document.getElementById('g-recaptcha-response').dispatchEvent(event);
    }, solution);
    await page.waitForTimeout(1000);
  } catch (error) {
    console.warn('CAPTCHA solving failed:', error);
  }
}