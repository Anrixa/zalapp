module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    // Venue photos come from object storage at unpredictable sizes; next/image
    // is used where it helps and plain img where the source is a data URL.
    '@next/next/no-img-element': 'off',
  },
};
