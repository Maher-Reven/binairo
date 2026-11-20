/** Pages is served at /binairo/. Local web and a root export leave the base path empty. */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return {
    ...config,
    experiments: {
      ...config.experiments,
      baseUrl,
    },
  };
};
