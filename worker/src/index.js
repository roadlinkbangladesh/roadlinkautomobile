export default {
  async fetch(request, env, ctx) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Roadlink API is running."
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
