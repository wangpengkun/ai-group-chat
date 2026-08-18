const config = {
  appId: 'com.workbuddy.aichat',
  appName: 'AI Group Chat',
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
