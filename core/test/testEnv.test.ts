describe("Test environment", () => {
  test("should have DEBUGG_AI_GLOBAL_DIR env var set to .continue-test", () => {
    expect(process.env.DEBUGG_AI_GLOBAL_DIR).toBeDefined();
    expect(process.env.DEBUGG_AI_GLOBAL_DIR)?.toMatch(/\.continue-test$/);
  });
});
