// Analytics and performance monitoring for GameSalad
// Similar functionality to KrisEnigma and GameList

(function () {
    'use strict';

    // Wait for the page to load completely
    window.addEventListener('load', () => {
        // Basic performance monitoring
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            console.log('Page Load Time:', loadTime + 'ms');

            // Send to GA if available
            if (typeof window.gtag !== 'undefined') {
                window.gtag('event', 'page_load_time', {
                    event_category: 'Performance',
                    value: Math.round(loadTime),
                    non_interaction: true,
                });
            }
        }

        // Monitor FPS if possible
        let frames = 0;
        let lastTime = performance.now();

        function countFrames(currentTime) {
            frames++;
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round((frames * 1000) / (currentTime - lastTime));

                // Send FPS data to analytics occasionally
                if (Math.random() < 0.1 && typeof window.gtag !== 'undefined') { // 10% chance
                    window.gtag('event', 'fps_measurement', {
                        event_category: 'Performance',
                        value: fps,
                        non_interaction: true,
                    });
                }

                frames = 0;
                lastTime = currentTime;
            }
            requestAnimationFrame(countFrames);
        }
        requestAnimationFrame(countFrames);
    });

    // Error tracking
    window.addEventListener('error', (event) => {
        console.error('JavaScript Error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });

        // Send to analytics if available
        if (typeof window.gtag !== 'undefined') {
            window.gtag('event', 'exception', {
                description: event.message,
                fatal: false
            });
        }
    });

    // Unhandled promise rejection tracking
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise Rejection:', event.reason);

        // Send to analytics if available
        if (typeof window.gtag !== 'undefined') {
            window.gtag('event', 'exception', {
                description: 'Unhandled Promise Rejection: ' + event.reason,
                fatal: false
            });
        }
    });

    // Game-specific analytics events
    window.GameAnalytics = {
        // Track when a game level starts
        trackLevelStart: function (level) {
            if (typeof window.gtag !== 'undefined') {
                window.gtag('event', 'level_start', {
                    event_category: 'Game',
                    custom_parameter: level
                });
            }
        },

        // Track when a game level is completed
        trackLevelComplete: function (level, timeSpent) {
            if (typeof window.gtag !== 'undefined') {
                window.gtag('event', 'level_complete', {
                    event_category: 'Game',
                    custom_parameter: level,
                    value: Math.round(timeSpent / 1000) // Convert to seconds
                });
            }
        },

        // Track game actions
        trackGameAction: function (action, value) {
            if (typeof window.gtag !== 'undefined') {
                window.gtag('event', 'game_action', {
                    event_category: 'Game',
                    event_label: action,
                    value: value || 1
                });
            }
        }
    };

})();
