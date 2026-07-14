export default {
  root: new URL(".", import.meta.url).pathname,
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
};
