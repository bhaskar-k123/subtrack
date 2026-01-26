"""Decrypt the PDF then test the parser"""
from pypdf import PdfReader, PdfWriter

print("Step 1: Decrypting test.pdf...")
r = PdfReader('test.pdf')
print(f"Is encrypted: {r.is_encrypted}")

if r.is_encrypted:
    result = r.decrypt('214863375')
    print(f"Decrypt result: {result}")

print(f"Total pages: {len(r.pages)}")

w = PdfWriter()
for page in r.pages:
    w.add_page(page)

with open('test_dec.pdf', 'wb') as f:
    w.write(f)
print("Step 2: Saved decrypted PDF to test_dec.pdf")

# Now test the parser
print("\nStep 3: Testing fast_parser...")
from fast_parser import parse_pdf_fast
txns, val = parse_pdf_fast('test_dec.pdf')

print(f"\nResult: {len(txns) if txns else 0} transactions")
print(f"Validation: {val}")

if txns and len(txns) > 0:
    print("\nFirst 5 transactions:")
    for t in txns[:5]:
        print(f"  {t['date']} | {t['transactionType']:>6} | Rs.{t['amount']:>10.2f} | Bal: Rs.{t['closingBalance']:>10.2f}")
    print(f"\nLast transaction balance: Rs.{txns[-1]['closingBalance']:,.2f}")
else:
    print("No transactions extracted!")
