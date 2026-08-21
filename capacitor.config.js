const config = {
  appId: 'com.zhuzibaishang.aichat',
  appName: '诸子百商多智能体群聊',
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
