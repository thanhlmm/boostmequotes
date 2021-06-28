const headers = {
  "Access-Control-Allow-Origin": "*",
  "content-type": "application/json;charset=UTF-8"
};

export async function getRandomImage(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const topics = searchParams.get('topics')

  return fetch(
    'https://api.unsplash.com/photos/random?client_id=mofCb02A6mHMmxL0BQ_T25vUYbAOH4hDFUApVfyHpfs&topics=' + topics,
    { method: 'GET' }
  )
    .then((response) => response.json())
    .then((result) => {
      return new Response(JSON.stringify(result), {
        headers
      })
    })
    .catch((error) => new Response(JSON.stringify(error), {
      headers
    }));
}
