/**
 * @typedef ICursor
 * @property {number} ripples The cursor ripples amount
 * @property {number} size The cursor size
 * @property {number} borderSize The cursor border size
 * @property {string} fillColor The cursor fill color
 * @property {string} strokeColor The cursor stroke color
 * @property {number} colorIntensity The cursor color intensity
 * @property {{x: number, y: number}} position The cursor position
 */

if (typeof registerPaint !== "undefined") {
    class Cursor {
        static get inputProperties() {
            return [
                "--cursor-ripples",
                "--cursor-size",
                "--cursor-border-size",
                "--cursor-fill-color",
                "--cursor-stroke-color",
                "--cursor-color-intensity",
                "--cursor-position-x",
                "--cursor-position-y",
            ];
        }

        /**
         * Draws the cursor
         * @param {CanvasRenderingContext2D} ctx The canvas context
         * @param {ICursor} cursor The cursor object
         */
        draw(ctx, cursor) {
            const { size, borderSize, colorIntensity, position } = cursor;

            ctx.beginPath();
            ctx.arc(position.x, position.y, size, 0, 2 * Math.PI, false);
            // Fill
            ctx.fillStyle = `rgba(${cursor.fillColor}, ${colorIntensity})`;
            ctx.fill();
            // Stroke
            ctx.lineWidth = borderSize;
            ctx.strokeStyle = `rgba(${cursor.strokeColor}, ${colorIntensity})`;
            ctx.stroke();
        }

        paint(ctx, _size, properties) {
            const cursor = Object.freeze({
                ripples: parseFloat(properties.get("--cursor-ripples")),
                size: parseFloat(properties.get("--cursor-size")),
                borderSize: parseFloat(properties.get("--cursor-border-size")),
                fillColor: properties.get("--cursor-fill-color"),
                strokeColor: properties.get("--cursor-stroke-color"),
                colorIntensity: parseFloat(properties.get("--cursor-color-intensity")),
                position: {
                    x: parseFloat(properties.get("--cursor-position-x")),
                    y: parseFloat(properties.get("--cursor-position-y")),
                },
            });

            for (let i = 0; i < cursor.ripples; i++) {
                this.draw(ctx, { ...cursor, size: cursor.size * i * 1.5 });
            }
        }
    }

    registerPaint("cursor", Cursor);
}
