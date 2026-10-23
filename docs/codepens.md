# CodePen collection

[CSS Houdini collection](https://codepen.io/collection/bNWgYw)

The twelve studio demos load their renderer and pointer helper from the published npm packages through versioned jsDelivr URLs. HTML, CSS, and JavaScript are formatted separately. No renderer implementation is copied into a Pen.

| Effect       | Pen                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------- |
| Aurora       | [Open](https://codepen.io/editor/emilio-dominguez/pen/01a166b1-75ff-7910-ba62-f6d724fcd8c4) |
| Particles    | [Open](https://codepen.io/editor/emilio-dominguez/pen/01a166ae-44a8-7cb2-a55d-d1289481309b) |
| Cursor       | [Open](https://codepen.io/editor/emilio-dominguez/pen/01a166b1-9283-7d48-8ce1-01a2800023cf) |
| Flow field   | [Open](https://codepen.io/emilio-dominguez/pen/RNpBWeW)                                     |
| Ripples      | [Open](https://codepen.io/emilio-dominguez/pen/ByWPoqp)                                     |
| Iridescence  | [Open](https://codepen.io/emilio-dominguez/pen/jEBpbea)                                     |
| Caustics     | [Open](https://codepen.io/emilio-dominguez/pen/pveZjxa)                                     |
| Vortex       | [Open](https://codepen.io/emilio-dominguez/pen/yyMqYRK)                                     |
| Terrain      | [Open](https://codepen.io/emilio-dominguez/pen/emvjpPL)                                     |
| Nebula       | [Open](https://codepen.io/emilio-dominguez/pen/zxZLvmy)                                     |
| Metaballs    | [Open](https://codepen.io/emilio-dominguez/pen/azJjvRM)                                     |
| Kaleidoscope | [Open](https://codepen.io/emilio-dominguez/pen/LEWBpgw)                                     |

## Prepare the source

```sh
npm run codepens:prepare
python3 -m http.server 4175 --bind 127.0.0.1 --directory artifacts/codepens
```

Open `http://127.0.0.1:4175/` to preview the demos, inspect the source, or import a new Pen through CodePen's documented prefill form. Save the imported Pen and add it to CSS Houdini.

Each effect has `index.html`, `style.css`, `script.js`, and `prefill.json` in `artifacts/codepens/`. These generated files use the version in the corresponding package's `package.json`; publish that version to npm before importing a new demo.

## API publishing

The [official CodePen API](https://blog.codepen.io/docs/api/api-v2/rest-api-v2/) can create a Pen with all three files in one request, then add it to the collection in a second request.

```sh
# Set CODEPEN_API_KEY in your environment, or point CODEPEN_API_KEY_FILE
# at a private file containing your key. Do not commit credentials.
npm run codepens:publish
```

The script reads `docs/codepens.json` to preserve the existing Pens, records progress in `artifacts/codepens/published.json`, skips recorded creations, and checks collection membership once at the end. It does not overwrite existing Pen source. To prepare and validate without publishing, run `node scripts/publish-codepens.mjs`.

The API has separate request and daily creation limits. During this publication, the free plan allowed only three API-created Pens per day. The remaining nine were imported through the editor. The script stops on quota errors and never retries a create request automatically. A local limit of 85 requests per hour leaves room within a 100-request allowance.

If a network failure leaves a create request's outcome uncertain, reconcile that Pen in CodePen before retrying. The progress file deliberately retains `pendingCreation` to prevent duplicate public Pens.
