// Minimal entry point for the isolated /qa/opening-journey-video reference
// page — the ORIGINAL video.currentTime-scrub engine, kept only for
// comparison against the live frame-sequence version at /qa/opening-journey.
import { initCtaBar } from './cta-bar';
import { initOpeningJourney } from './opening-journey-video-scrub';

initCtaBar();
initOpeningJourney();
