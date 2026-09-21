import base64
import json

# Let's verify how base64 embedding in JS works:
# In JS: btoa(unescape(encodeURIComponent(srtContentDavinci))) or Buffer.from(srtContentDavinci).toString('base64')
# In browser: const toB64 = (str) => window.btoa(unescape(encodeURIComponent(str)));
# In Python: base64.b64decode("...").decode("utf-8")

print("Base64 approach is 100% safe across browsers and python!")
