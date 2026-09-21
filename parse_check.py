import re
import ast

with open("src/App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

start_idx = text.find("const handleExportDavinciPythonScript = () => {")
end_idx = text.find("setDavinciScriptData({", start_idx)

func_code = text[start_idx:end_idx]

# Let's extract all pyScript += `...`
pattern = re.compile(r'pyScript \+= `([\s\S]*?)`;')
matches = pattern.findall(func_code)

output_py = []
for m in matches:
    # replace ${...} with dummy strings
    m_sub = re.sub(r'\$\{.*?\}', 'DUMMY_VAR', m)
    output_py.append(m_sub)

full_py = "".join(output_py)

with open("full_test.py", "w", encoding="utf-8") as pf:
    pf.write(full_py)

print(f"Generated test python script: {len(full_py)} chars, {len(full_py.splitlines())} lines")

try:
    ast.parse(full_py)
    print("SUCCESS: Python script parses cleanly with no syntax errors!")
except SyntaxError as e:
    print(f"SYNTAX ERROR on line {e.lineno}, offset {e.offset}: {e.msg}")
    lines = full_py.splitlines()
    for i in range(max(0, e.lineno - 5), min(len(lines), e.lineno + 5)):
        print(f"{i+1}: {lines[i]}")
