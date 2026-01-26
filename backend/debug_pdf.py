"""Debug script for PDF parsing"""
import pdfplumber

pdf_path = "test.pdf"
password = "214863375"

print("Opening PDF...")
try:
    with pdfplumber.open(pdf_path, password=password) as pdf:
        print(f"Pages: {len(pdf.pages)}")
        
        # Extract first page text
        page = pdf.pages[0]
        text = page.extract_text()
        print(f"\n=== Page 1 Text ({len(text) if text else 0} chars) ===")
        print(text[:2000] if text else "NO TEXT EXTRACTED")
        
        # Extract words for balance spine detection
        words = page.extract_words()
        print(f"\n=== Found {len(words)} words ===")
        
        # Filter numeric tokens (like fast_parser does)
        numerics = []
        for w in words:
            txt = w['text'].replace(',', '').strip()
            try:
                val = float(txt)
                if '.' in w['text'] or val > 1000:
                    numerics.append({'text': w['text'], 'x0': w['x0'], 'value': val})
            except:
                pass
        
        print(f"\n=== Found {len(numerics)} numeric tokens ===")
        for n in numerics[:20]:
            print(f"  x={n['x0']:.1f} val={n['value']} text='{n['text']}'")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
