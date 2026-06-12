module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Keep this plugin as the last item
      'react-native-reanimated/plugin',
    ],
  };
};
