import re
import ast

with open("src/App.tsx", "r", encoding="utf-8") as f:
    app_text = f.read()

# Let's inspect the entire handleExportDavinciPythonScript function
start_idx = app_text.find("const handleExportDavinciPythonScript = () => {")
end_idx = app_text.find("setDavinciScriptData({", start_idx)

func_body = app_text[start_idx:end_idx]
print(f"Func body length: {len(func_body)}")

# Let's check for any occurrences of backslashes or escape issues in pyScript
for i, line in enumerate(func_body.splitlines()):
    if "replace(" in line or "\\" in line:
        if "pyScript +=" in line:
            print(f"Line {i+1}: {line}")
