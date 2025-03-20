/**
 * Tooltip functionality for Echo Life app
 * Handles custom tooltips and info banners
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize tooltips for better mobile experience
    initTooltips();
    
    // Handle info banner
    setupInfoBanner();
    
    // Apply translations to all elements with data-i18n attribute
    applyTranslations();
    
    // Listen for language changes to update translations
    window.addEventListener('languageChanged', (e) => {
        applyTranslations(e.detail.language);
    });
});

/**
 * Initialize tooltip functionality with better mobile support
 */
function initTooltips() {
    const tooltipTriggers = document.querySelectorAll('.tooltip-trigger');
    
    tooltipTriggers.forEach(trigger => {
        // For mobile: handle touch events
        trigger.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // Close all other open tooltips first
            document.querySelectorAll('.tooltip-content.active').forEach(tooltip => {
                if (tooltip !== trigger.nextElementSibling) {
                    tooltip.classList.remove('active');
                }
            });
            
            // Toggle this tooltip
            const tooltip = trigger.nextElementSibling;
            tooltip.classList.toggle('active');
            
            // Position check for mobile
            ensureTooltipVisibility(tooltip);
        });
        
        // Add keyboard accessibility
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trigger.nextElementSibling.classList.toggle('active');
                ensureTooltipVisibility(trigger.nextElementSibling);
            }
        });
        
        // Close on document click
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target)) {
                trigger.nextElementSibling.classList.remove('active');
            }
        });
    });
}

/**
 * Ensure tooltip is fully visible on screen
 */
function ensureTooltipVisibility(tooltip) {
    const rect = tooltip.getBoundingClientRect();
    
    // Check if tooltip is off-screen to the left
    if (rect.left < 0) {
        tooltip.style.left = '0';
        tooltip.style.right = 'auto';
        tooltip.style.transform = 'translateX(0)';
    }
    
    // Check if tooltip is off-screen to the right
    if (rect.right > window.innerWidth) {
        tooltip.style.left = 'auto';
        tooltip.style.right = '0';
        tooltip.style.transform = 'translateX(0)';
    }
    
    // Check if tooltip is off-screen at the top
    if (rect.top < 0) {
        tooltip.style.top = '100%';
        tooltip.style.bottom = 'auto';
        
        // Change the arrow position
        tooltip.classList.add('bottom-tooltip');
    }
}

/**
 * Set up the info banner for first-time users
 */
function setupInfoBanner() {
    const banner = document.getElementById('firstTimeUserBanner');
    const closeButton = banner.querySelector('.info-close');
    
    // Check if user has seen the banner before
    const hasSeenBanner = localStorage.getItem('echolife_seen_banner');
    
    if (hasSeenBanner) {
        banner.style.display = 'none';
    }
    
    // Handle close button
    closeButton.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem('echolife_seen_banner', 'true');
    });
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations(language) {
    if (!language) {
        language = localStorage.getItem('echolife_language') || 'en-US';
    }
    
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = getTranslation(key, language);
        
        if (translation) {
            element.textContent = translation;
        }
    });
}

/**
 * Helper function to get translation for a key
 * This relies on the existing translations.js file
 */
function getTranslation(key, language) {
    // This assumes the existing getTranslation function from translations.js
    // If that's not available, we can implement a simplified version here
    if (typeof window.getTranslation === 'function') {
        return window.getTranslation(key, language);
    }
    
    // Fallback to English if getTranslation isn't available
    return key;
}
