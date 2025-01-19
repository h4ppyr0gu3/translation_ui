const { override, addWebpackAlias } = require('customize-cra');
const path = require('path');

module.exports = override(
  addWebpackAlias({
    '@/src/lib/utils': path.resolve(__dirname, 'src/lib/utils.js'),
    '@/components/ui': path.resolve(__dirname, 'src/components/ui'),
    '@/hooks': path.resolve(__dirname, 'src/hooks')
  })
);
