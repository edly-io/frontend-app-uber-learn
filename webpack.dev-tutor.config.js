// webpack-merge comes with @openedx/frontend-build.
// eslint-disable-next-line import/no-extraneous-dependencies
const { merge } = require('webpack-merge');
const fs = require('fs');

const baseDevConfig = (
  fs.existsSync('./webpack.dev.config.js')
    ? require('./webpack.dev.config.js')
    : require('@openedx/frontend-build/config/webpack.dev.config.js')
);

module.exports = merge(baseDevConfig, {
  devServer: {
    allowedHosts: 'all',
    proxy: {
      '/api/mfe_config/v1': {
        target: 'http://local.openedx.io:8000',
        changeOrigin: true,
      },
    },
  },
});
