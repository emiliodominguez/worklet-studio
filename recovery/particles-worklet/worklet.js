//#region Helpers
/**
 * Returns a random number between min and max
 * @param min The minimun number
 * @param max The maxium number
 * @returns The random number
 */
function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Converts a HEX color to RGB
 * @param hex The HEX color
 * @returns An array containing the RGB values
 */
function hexToRgb(hex) {
    const shortHexRegExp = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shortHexRegExp, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    if (!result) throw Error("A valid HEX must be provided");

    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ];
}

/**
 * Gets a random HEX color
 */
function getRandomHex() {
    return `#${Math.floor(Math.random() * (0xffffff + 1))
        .toString(16)
        .padStart(6, "0")}`;
}

/**
 * Perform a linear interpolation between two colors
 * @param colorA The color A
 * @param colorB The color B
 * @param amount The amount
 * @returns The resultant color
 */
function lerpHexColors(colorA, colorB, amount) {
    const ah = +colorA.replace("#", "0x");
    const ar = ah >> 16;
    const ag = (ah >> 8) & 0xff;
    const ab = ah & 0xff;
    const bh = +colorB.replace("#", "0x");
    const br = bh >> 16;
    const bg = (bh >> 8) & 0xff;
    const bb = bh & 0xff;
    const rr = ar + amount * (br - ar);
    const rg = ag + amount * (bg - ag);
    const rb = ab + amount * (bb - ab);

    return `#${(((1 << 24) + (rr << 16) + (rg << 8) + rb) | 0)
        .toString(16)
        .slice(1)}`;
}

/**
 * Gets the distance between two particles
 * @param particleA The particle A
 * @param particleB The particle B
 * @returns The distance between both particles
 */
function getParticlesDistance(particleA, particleB) {
    const x = particleB.position.x - particleA.position.x;
    const y = particleB.position.y - particleA.position.y;
    return Math.sqrt(x * x + y * y);
}
//#endregion

//#region Particle class
class Particle {
    /**
     * Creates a new particle
     * @param position The position
     * @param size The size
     * @param color The color
     */
    constructor(position, size, color) {
        this.position = position;
        this.size = size;
        this.color = color;
    }

    /**
     * Updates the particle position on the canvas and re draws it
     * @param context The canvas context
     */
    update(context) {
        this.draw(context);
    }

    /**
     * Draws the particle on the canvas
     * @param context The canvas context
     * @param glow Defines if the particle should have a glow effect or not
     */
    draw(context, glow = true) {
        context.beginPath();
        context.arc(
            this.position.x,
            this.position.y,
            this.size,
            0,
            Math.PI * 2,
            false
        );
        context.fillStyle = this.color;

        if (glow) {
            context.shadowBlur = getRandomInteger(15, 30);
            context.shadowColor = `rgba(${hexToRgb(this.color).join(",")}, 0.85)`;
        }

        context.fill();
    }
}
//#endregion

if (typeof registerPaint !== "undefined") {
    class Particles {
        static get inputProperties() {
            return [
                "--particles-count",
                "--particles-size-min",
                "--particles-size-max",
                "--particles-lines-threshold",
            ];
        }

        paint(ctx, size, properties) {
            const particles = new Map();
            const configuration = Object.freeze({
                amount: parseFloat(properties.get("--particles-count")),
                size: {
                    min: parseFloat(properties.get("--particles-size-min")),
                    max: parseFloat(properties.get("--particles-size-max"))
                },
                linesDistanceThreshold: parseFloat(properties.get("--particles-lines-threshold"))
            });

            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, size.width, size.height);

            for (let i = 0; i < configuration.amount; i++) {
                const randomSize = getRandomInteger(configuration.size.min, configuration.size.max);
                const position = {
                    x: Math.random() * size.width,
                    y: Math.random() * size.height
                };
                const color = getRandomHex();
                const particle = new Particle(position, randomSize, color);
                particles.set(i, particle);
                particle.update(ctx)
            }

            for (let i = 0; i < configuration.amount; i++) {
                for (let j = 0; j < configuration.amount; j++) {
                    const particleA = particles.get(i);
                    const particleB = particles.get(j);
                    const distance = getParticlesDistance(particleA, particleB);

                    if (distance < configuration.linesDistanceThreshold) {
                        const color = hexToRgb(lerpHexColors(particleA.color, particleB.color, 0.5)).join(",");
                        const opacity = 1 - distance / configuration.linesDistanceThreshold;

                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(${[color, opacity].join(",")})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particleA.position.x, particleA.position.y);
                        ctx.lineTo(particleB.position.x, particleB.position.y);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    registerPaint("particles", Particles);
}