import { initReveal } from './reveal';
import { initOpeningJourney } from './opening-journey-scrub';
import { initCtaBar } from './cta-bar';
import { initKitSwipe } from './kit-swipe';
import { initAssistant } from './assistant';
import { initWhatsAppClickTracking, initClarityBridge } from './analytics';

initClarityBridge();
initReveal();
initOpeningJourney();
initCtaBar();
initKitSwipe();
initAssistant();
initWhatsAppClickTracking();
