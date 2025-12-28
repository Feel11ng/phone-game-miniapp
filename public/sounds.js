// Sound effects manager for the application
class SoundManager {
    constructor() {
        this.sounds = {};
        this.isMuted = false;
        this.volume = 0.5;
        this.initializeSounds();
    }

    // Initialize all sound effects
    initializeSounds() {
        // Preload all sounds
        this.sounds = {
            buttonClick: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3'),
            success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'),
            error: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-warning-alarm-buzzer-991.mp3'),
            notification: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'),
            openCase: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3'),
            coin: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-coins-handling-1939.mp3'),
            cardFlip: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-playing-card-alert-714.mp3'),
            win: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3')
        };

        // Set volume for all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
            sound.load(); // Preload sounds
        });
    }

    // Play a sound by name
    play(soundName, options = {}) {
        if (this.isMuted) return null;

        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Sound '${soundName}' not found`);
            return null;
        }

        // Create a clone of the audio to allow overlapping sounds
        const soundClone = sound.cloneNode();
        soundClone.volume = options.volume !== undefined ? options.volume : this.volume;
        
        // Play the sound
        soundClone.play().catch(e => console.warn('Audio play failed:', e));
        
        // Clean up after the sound finishes playing
        soundClone.addEventListener('ended', () => {
            soundClone.remove();
        });

        return soundClone;
    }

    // Toggle mute state
    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    // Set volume (0 to 1)
    setVolume(volume) {
        this.volume = Math.min(1, Math.max(0, volume));
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }

    // Play haptic feedback if available
    hapticFeedback(type = 'light') {
        if (!window.navigator.vibrate) return false;
        
        const patterns = {
            light: 50,          // Light tap
            medium: 100,        // Medium tap
            heavy: 200,         // Heavy tap
            success: [100, 50, 100],  // Success pattern
            error: [50, 50, 50, 50, 50], // Error pattern
            warning: [100, 30, 100, 30, 100] // Warning pattern
        };

        const pattern = patterns[type] || patterns.light;
        return navigator.vibrate(pattern);
    }
}

// Create a global instance
const soundManager = new SoundManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoundManager, soundManager };
}

export { SoundManager, soundManager };
export default soundManager;
