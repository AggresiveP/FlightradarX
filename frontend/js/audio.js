/**
 * Swedavia FlightInfo Ultimate 3D Edition - Cockpit Audio Synthesis Engine
 * Uses the Web Audio API to synthesize real-time immersive soundscapes:
 * 1. Cabin Hum: Dual detuned low-frequency oscillators with LFO gain modulation.
 * 2. Radar Ping: Resonant bandpass sweep with a feedback delay loop (echo/reverb).
 * 3. Targeting Lock: Cybernetic high-pitched triple-chime chime.
 * 4. Radio Static: High-pass filtered white noise bursts simulating air traffic control transmissions.
 */

class CockpitAudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = true;

        // Audio nodes
        this.mainVolume = null;

        // Cabin Hum nodes
        this.humOsc1 = null;
        this.humOsc2 = null;
        this.humLFO = null;
        this.humLFOGain = null;
        this.humFilter = null;
        this.humGain = null;

        // Radio Static interval
        this.staticInterval = null;
    }

    /**
     * Initializes the AudioContext (must run inside a user interaction callback)
     */
    init() {
        if (this.ctx) return;

        // Create Web Audio Context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();

        // Main output volume master node
        this.mainVolume = this.ctx.createGain();
        this.mainVolume.gain.setValueAtTime(0.0, this.ctx.currentTime); // start silent, fade in
        this.mainVolume.connect(this.ctx.destination);
    }

    /**
     * Toggles the audio engine states (Mute/Unmute)
     */
    toggleMute() {
        this.init();

        if (this.isMuted) {
            // Unmute
            this.isMuted = false;

            const startAudio = () => {
                // Smoothly fade in master volume
                this.mainVolume.gain.setValueAtTime(this.mainVolume.gain.value, this.ctx.currentTime);
                this.mainVolume.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.5);

                // Start components
                this._startCabinHum();
                this._startRadioStaticScheduler();
            };

            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(startAudio);
            } else {
                startAudio();
            }
        } else {
            // Mute
            this.isMuted = true;

            // Smoothly fade out master volume, then stop oscillators after fade completes
            this.mainVolume.gain.setValueAtTime(this.mainVolume.gain.value, this.ctx.currentTime);
            this.mainVolume.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.15);

            setTimeout(() => {
                if (this.isMuted) {
                    this._stopCabinHum();
                    this._stopRadioStaticScheduler();
                }
            }, 600);
        }

        return this.isMuted;
    }

    /**
     * Synthesizes the ambient jet engine cabin hum
     */
    _startCabinHum() {
        // Cabin hum disabled per user request to keep cockpit silent until clicked
        return;
    }

    /**
     * Synthesizes a randomized pilot transmission using the Web Speech API
     * wrapped in realistic radio static bursts.
     */
    playPilotTalk(flightNumber, originCity, destCity, altitude, speed) {
        if (this.isMuted || !this.ctx) return;

        // 1. Play opening radio static burst
        this._playRadioStaticBurst();

        // 2. Synthesize pilot speech after a tiny delay
        setTimeout(() => {
            if (this.isMuted) return;

            const scripts = [
                `Arlanda Tower, this is flight ${flightNumber}. We are currently cruising at ${Math.round(altitude)} meters, airspeed ${Math.round(speed)} kilometers per hour. Requesting descent vector into ${destCity}, over.`,
                `This is flight ${flightNumber} to cabin crew. Prepare for arrival in ${destCity}. Weather is reported clear, current altitude ${Math.round(altitude)} meters, over.`,
                `Control, this is ${flightNumber} en route from ${originCity} to ${destCity}. Maintaining altitude ${Math.round(altitude)} meters, speed ${Math.round(speed)} kilometers per hour, heading correct, over.`,
                `Roger, control. ${flightNumber} has passed flight level ${Math.round(altitude / 100)}. Descending to meet coordinates for runway landing in ${destCity}, over.`,
                `This is pilot on flight ${flightNumber} speaking. We are currently flying at altitude ${Math.round(altitude)} meters, estimating arrival in ${destCity} on schedule, over.`
            ];
            const phrase = scripts[Math.floor(Math.random() * scripts.length)];

            const utterance = new SpeechSynthesisUtterance(phrase);

            // Try to find a suitable English voice
            const voices = window.speechSynthesis.getVoices();
            const enVoices = voices.filter(v => v.lang.startsWith('en'));
            if (enVoices.length > 0) {
                // Try to choose a male/authoritative sounding voice if available, or just a random one
                const maleVoice = enVoices.find(v =>
                    v.name.toLowerCase().includes('david') ||
                    v.name.toLowerCase().includes('microsoft') ||
                    v.name.toLowerCase().includes('male') ||
                    v.name.toLowerCase().includes('guy')
                );
                utterance.voice = maleVoice || enVoices[Math.floor(Math.random() * enVoices.length)];
            }

            utterance.pitch = 0.85; // lower pitch to sound more like a cockpit radio
            utterance.rate = 0.95;  // slightly slower pace for realism

            // Play closing radio static burst when speech ends
            utterance.onend = () => {
                if (!this.isMuted) {
                    this._playRadioStaticBurst();
                }
            };

            utterance.onerror = () => {
                if (!this.isMuted) {
                    this._playRadioStaticBurst();
                }
            };

            window.speechSynthesis.cancel(); // cancel any active speech first
            window.speechSynthesis.speak(utterance);
        }, 350);
    }

    /**
     * Stops the cabin hum sound generator
     */
    _stopCabinHum() {
        try {
            if (this.humOsc1) { this.humOsc1.stop(); this.humOsc1.disconnect(); this.humOsc1 = null; }
            if (this.humOsc2) { this.humOsc2.stop(); this.humOsc2.disconnect(); this.humOsc2 = null; }
            if (this.humLFO) { this.humLFO.stop(); this.humLFO.disconnect(); this.humLFO = null; }
            if (this.humLFOGain) { this.humLFOGain.disconnect(); this.humLFOGain = null; }
            if (this.humGain) { this.humGain.disconnect(); this.humGain = null; }
            if (this.humFilter) { this.humFilter.disconnect(); this.humFilter = null; }
        } catch (e) {
            console.warn("Error stopping cabin hum:", e);
        }
    }

    /**
     * Triggers a high-tech sonar ping with feedback delay echo
     */
    playSonarPing() {
        if (this.isMuted || !this.ctx) return;

        // Ping frequency parameters
        const now = this.ctx.currentTime;
        const frequency = 780; // High resonant radar ping

        // Ping generator
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.exponentialRampToValueAtTime(frequency / 2, now + 0.35);

        // Amplitude Envelope
        const amp = this.ctx.createGain();
        amp.gain.setValueAtTime(0.22, now);
        amp.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        // Resonant Bandpass Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(3.0, now);
        filter.frequency.setValueAtTime(frequency, now);

        // Feedback Delay Loop (creates the space/depth echoing effect)
        const delay = this.ctx.createDelay();
        delay.delayTime.setValueAtTime(0.24, now); // 240ms echo interval

        const delayGain = this.ctx.createGain();
        delayGain.gain.setValueAtTime(0.40, now); // echo feedback gain

        // Connect delay loop
        delay.connect(delayGain);
        delayGain.connect(delay); // loop back

        // Connect nodes
        osc.connect(filter);
        filter.connect(amp);

        amp.connect(this.mainVolume); // Direct signal
        amp.connect(delay);           // Echo signal
        delayGain.connect(this.mainVolume);

        osc.start(now);
        osc.stop(now + 1.2);
    }

    /**
     * Triggers a cyber target lock-on chime sequence (triple rising beep)
     */
    playTargetLock() {
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [880, 1174, 1568]; // A5 -> D6 -> G6 (cyber chord sweep)
        const duration = 0.05; // very snappy
        const delayBetween = 0.06;

        notes.forEach((freq, index) => {
            const time = now + (index * delayBetween);

            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.15, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.15);

            osc.connect(gain);
            gain.connect(this.mainVolume);

            osc.start(time);
            osc.stop(time + duration + 0.2);
        });
    }

    /**
     * Schedules dynamic bursts of filtered static (cockpit ATC radio simulation)
     */
    _startRadioStaticScheduler() {
        if (!this.ctx) return;

        const scheduleNext = () => {
            if (this.isMuted) return;

            // Random delay between static bursts: 10 to 25 seconds
            const nextDelay = (Math.random() * 15 + 10) * 1000;

            this.staticInterval = setTimeout(() => {
                if (!this.isMuted) {
                    this._playRadioStaticBurst();
                    scheduleNext();
                }
            }, nextDelay);
        };

        scheduleNext();
    }

    _stopRadioStaticScheduler() {
        if (this.staticInterval) {
            clearTimeout(this.staticInterval);
            this.staticInterval = null;
        }
    }

    /**
     * Generates a 0.5s - 1.2s burst of high-pass filtered white noise
     */
    _playRadioStaticBurst() {
        if (this.isMuted || !this.ctx) return;

        const duration = Math.random() * 0.7 + 0.5; // 0.5s to 1.2s
        const now = this.ctx.currentTime;

        // 1. Create White Noise Buffer
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Noise source
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        // 2. High-pass filter to sound like thin, tinny radio transmissions
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now); // center around 2.2 kHz
        filter.Q.setValueAtTime(0.8, now);

        // 3. Amplitude Envelope (crackly start/end)
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.0, now);
        gainNode.gain.linearRampToValueAtTime(0.015, now + 0.05); // quick crackle in

        // Subtle volume crackles during the burst
        for (let t = 0.1; t < duration - 0.1; t += 0.15) {
            gainNode.gain.setValueAtTime(0.010 + Math.random() * 0.01, now + t);
        }

        gainNode.gain.setValueAtTime(0.012, now + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0.0, now + duration); // quick fade out

        // Connect and play
        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.mainVolume);

        noiseNode.start(now);
    }
}

// Instantiate globally so it can be accessed across globe.js and app.js
const audioSuite = new CockpitAudioEngine();
window.audioSuite = audioSuite;
