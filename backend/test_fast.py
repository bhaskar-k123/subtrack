"""Quick test of fixed fast_parser"""
from pypdf import PdfReader, PdfWriter
from fast_parser import parse_pdf_fast

# Decrypt PDF first
print("Decrypting PDF...")
r = PdfReader('test.pdf')
r.decrypt('214863375')
w = PdfWriter()
for p in r.pages:
    w.add_page(p)
with open('test_dec.pdf', 'wb') as f:
    w.write(f)
print("Saved decrypted PDF")

# Test fast parser
print("\nRunning fast parser...")
txns, val = parse_pdf_fast('test_dec.pdf')
print(f"Result: {len(txns) if txns else 0} transactions")
print(f"Validation: {val}")

if txns:
    print("\nSample transactions:")
    for t in txns[:3]:
        print(f"  {t['date']} {t['transactionType']:>6} {t['amount']:>10.2f}")
