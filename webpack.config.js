// const webpack = require('webpack');

// module.exports = {
//   // ... other webpack config ...
//   resolve: {
//     fallback: {
//       "fs": false,
//       "path": require.resolve("path-browserify"),
//       "os": require.resolve("os-browserify/browser"),
//       "http": require.resolve("stream-http"),
//       "https": require.resolve("https-browserify"),
//       "stream": require.resolve("stream-browserify"),
//       "crypto": require.resolve("crypto-browserify"),
//       "zlib": require.resolve("browserify-zlib"),
//       "assert": require.resolve("assert/"),
//       "url": require.resolve("url/"),
//       "util": require.resolve("util/"),
//       "net": false,
//       "tls": false,
//       "dns": false,
//       "child_process": false
//     }
//   },
//   plugins: [
//     new webpack.ProvidePlugin({
//       process: 'process/browser',
//     }),
//   ]
// };