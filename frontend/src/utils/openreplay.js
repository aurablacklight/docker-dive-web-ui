import Tracker from '@openreplay/tracker';
import trackerAssist from '@openreplay/tracker-assist';

// Initialize OpenReplay tracker
const tracker = new Tracker({
  projectKey: process.env.REACT_APP_OPENREPLAY_PROJECT_KEY || "YOUR_PROJECT_KEY_HERE",
  
  // Simple configuration for single environment app
  capturePerformance: true,
  captureResourceTimings: true,
  
  // Privacy settings
  obscureTextEmails: true,
  obscureTextNumbers: true,
  obscureInputEmails: true,
});

// Configure tracker assist options
const assistOptions = {
  // Enable/disable various assist features
  callConfirm: {
    text: 'Allow session recording for support?',
    style: { 
      backgroundColor: '#2196F3',
      color: 'white'
    }
  },
  controlConfirm: {
    text: 'Allow remote control for support?',
    style: {
      backgroundColor: '#ff9800', 
      color: 'white'
    }
  }
};

// Use tracker assist plugin
tracker.use(trackerAssist(assistOptions));

export default tracker;
