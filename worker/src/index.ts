
import { Router } from 'itty-router'
import { getRandomImage, getQuoteImage } from './handler'

// Create a new router
const router = Router();

router.get("/randomImage", getRandomImage);
router.get("/quoteImage", getQuoteImage);

router.all("*", () => new Response("404, not found!", { status: 404 }))

addEventListener('fetch', (event) => {
  event.respondWith(router.handle(event.request))
})
