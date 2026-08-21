const config = {
  appId: 'com.zhuzibaishang.aichat',
  appName: 'AI共识',
  webDir: 'src',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

module.exports = config;
