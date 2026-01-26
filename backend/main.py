"""
SubTrack Backend Server
=======================
FastAPI server with Docling for document processing.
Serves both the React frontend and the processing API.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import tempfile
import json
import os
from typing import Optional
from datetime import datetime
# from parser_pipeline import parse_pdf_pipeline  <-- Removed to fix ModuleNotFoundError

# PDF password handling
try:
    from pypdf import PdfReader, PdfWriter
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    print("⚠️ pypdf not available - password-protected PDFs won't be supported")

# Initialize FastAPI app
app = FastAPI(
    title="SubTrack API",
    description="Privacy-first document processing for expense tracking",
    version="1.0.0"
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Check if Docling is available and configure for speed
DOCLING_AVAILABLE = False
DOCLING_CONVERTER = None

try:
    import multiprocessing
    import os
    
    # Set thread count via environment variable for underlying libraries
    cpu_count = multiprocessing.cpu_count()
    os.environ.setdefault('OMP_NUM_THREADS', str(cpu_count))
    os.environ.setdefault('DOCLING_NUM_THREADS', str(cpu_count))
    
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import (
        PdfPipelineOptions,
        AcceleratorOptions,
        AcceleratorDevice,
        TableStructureOptions,
        TableFormerMode,
    )
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    
    # Accelerator options for multi-threaded CPU processing
    accelerator_options = AcceleratorOptions(
        num_threads=cpu_count,
        device=AcceleratorDevice.CPU,
    )
    
    # FAST table structure (good for bank statement tables, much faster than ACCURATE)
    table_options = TableStructureOptions(
        mode=TableFormerMode.FAST,
        do_cell_matching=False,  # Faster without cell matching
    )
    
    # Optimized pipeline options for CPU-only, speed-focused processing
    pipeline_options = PdfPipelineOptions(
        accelerator_options=accelerator_options,
        # Disable image generation for speed (we just need text)
        generate_page_images=False,
        generate_picture_images=False,
        generate_table_images=False,
        # Lower scale for faster processing
        images_scale=1.0,
        # Disable enrichment features we don't need for bank statements
        do_picture_classification=False,
        do_picture_description=False,
        do_code_enrichment=False,
        do_formula_enrichment=False,
        # Enable FAST table structure for transaction tables
        do_table_structure=True,
        table_structure_options=table_options,
        # Keep OCR enabled for scanned PDFs
        do_ocr=True,
    )
    
    # Create pre-configured converter at startup
    from docling.document_converter import PdfFormatOption
    
    DOCLING_CONVERTER = DocumentConverter(
        allowed_formats=[InputFormat.PDF, InputFormat.IMAGE, InputFormat.DOCX],
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
                backend=PyPdfiumDocumentBackend,
            )
        },
    )
    
    DOCLING_AVAILABLE = True
    print(f"✅ Docling configured for speed (using {cpu_count} CPU cores, pypdfium2 backend)")
except ImportError as e:
    print(f"⚠️ Docling not available: {e}")
    print("   Install with: pip install docling")
except Exception as e:
    print(f"⚠️ Docling configuration error: {e}")
    print("   Will use fallback text extraction")

# Simple fallback processor
def extract_text_simple(file_path: str) -> str:
    """Text extraction fallback when Docling isn't available or fails"""
    try:
        ext = Path(file_path).suffix.lower()
        
        # Use pypdf for PDF text extraction
        if ext == '.pdf' and PYPDF_AVAILABLE:
            try:
                reader = PdfReader(file_path)
                text_parts = []
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                if text_parts:
                    return '\n'.join(text_parts)
            except Exception as e:
                print(f"pypdf extraction failed: {e}")
        
        # Fallback for other file types
        with open(file_path, 'rb') as f:
            content = f.read()
            try:
                return content.decode('utf-8')
            except:
                return content.decode('latin-1')
    except Exception as e:
        return f"Error reading file: {e}"


def decrypt_pdf(file_path: str, password: str) -> tuple[str, bool, str]:
    """
    Decrypt a password-protected PDF.
    
    Returns:
        tuple: (decrypted_file_path, success, error_message)
    """
    if not PYPDF_AVAILABLE:
        return file_path, False, "pypdf not installed - cannot decrypt PDFs"
    
    try:
        reader = PdfReader(file_path)
        
        # Check if PDF is encrypted
        if not reader.is_encrypted:
            return file_path, True, ""  # Not encrypted, return original
        
        # Try to decrypt
        if not reader.decrypt(password):
            return file_path, False, "Incorrect password"
        
        # Write decrypted PDF to temp file
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        
        # Create temp file for decrypted PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            writer.write(tmp)
            decrypted_path = tmp.name
        
        return decrypted_path, True, ""
        
    except Exception as e:
        return file_path, False, f"Decryption error: {str(e)}"

def parse_transactions_from_text(text: str) -> list:
    """
    Parse transactions from HDFC Bank statement text.
    Expected columns: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
    """
    import re
    from datetime import datetime
    
    transactions = []
    lines = text.split('\n')
    
    # Header keywords to filter out
    header_keywords = [
        'hdfc bank', 'statement of account', 'page no', 'account branch',
        'address', 'city', 'state', 'phone', 'email', 'cust id',
        'account no', 'account status', 'branch code', 'nomination',
        'joint holders', 'od limit', 'currency', 'micr', 'ifsc',
        'we understand your world', 'from :', 'to :', 'registered',
        'narration', 'chq./ref.no', 'value dt', 'withdrawal amt', 
        'deposit amt', 'closing balance', 'opening balance', 'product code',
    ]
    
    # Date pattern for DD/MM/YY or DD/MM/YYYY at start of line
    date_pattern = r'^(\d{1,2})/(\d{1,2})/(\d{2,4})'
    
    # Amount pattern - must have decimal point with 1 or 2 digits (handle potential truncation)
    # This excludes date-like numbers and page numbers
    amount_pattern = r'([\d,]+\.\d{1,2})'
    
    current_transaction = None
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 5:
            continue
        
        # Skip header lines
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in header_keywords):
            continue
        
        # Check if line starts with a date (new transaction)
        date_match = re.match(date_pattern, line)
        
        if date_match:
            # Save previous transaction if exists
            if current_transaction:
                transactions.append(current_transaction)
            
            # Parse date
            day, month, year = date_match.groups()
            year = int(year)
            if year < 100:
                year = 2000 + year if year < 50 else 1900 + year
            
            try:
                iso_date = f"{year}-{int(month):02d}-{int(day):02d}"
            except:
                current_transaction = None
                continue
            
            # Remove date from line to get rest
            rest_of_line = line[date_match.end():].strip()
            
            # Remove value date (second date in line) from consideration
            rest_of_line = re.sub(r'\d{1,2}/\d{1,2}/\d{2,4}', ' ', rest_of_line)
            
            # Find all amounts with decimal point (proper currency format)
            amounts = re.findall(amount_pattern, rest_of_line)
            
            # Filter out small amounts that are likely not transactions
            amounts = [a for a in amounts if float(a.replace(',', '')) >= 0.01]
            
            # HDFC format: Usually [Withdrawal, Deposit, Balance] or [Amount, Balance]
            # Instead of guessing column position, we will store raw amounts and deduce type later using balance math
            
            closing_balance = 0.0
            amount_val = 0.0
            
            # The last amount with decimal is usually the closing balance
            if len(amounts) >= 2:
                try:
                    closing_balance = float(amounts[-1].replace(',', ''))
                except:
                    pass
            
            # The amount before specific balance-candidates could be the transaction amount
            # If only 1 amount found, assume it is the transaction AMOUNT, not balance
            if len(amounts) >= 1:
                try:
                    amount_val = float(amounts[0].replace(',', ''))
                except:
                    pass
            
            # Extract narration (remove amounts and special chars)
            narration = rest_of_line
            for amt in amounts:
                narration = narration.replace(amt, '')
            narration = re.sub(r'[^\w\s\-\./]', ' ', narration).strip()
            # Clean up extra spaces
            narration = ' '.join(narration.split())[:100]
            
            if not narration or len(narration) < 3:
                narration = "Transaction"
            
            # Logic to determine Credit vs Debit will be applied in post-processing
            # Store raw values for now
            current_transaction = {
                "date": iso_date,
                "merchantRaw": narration,
                "amount": amount_val,
                "raw_amounts": [float(a.replace(',', '')) for a in amounts],
                "transactionType": "unknown", # To be determined
                "closingBalance": closing_balance,
                "confidenceScore": 85,
                "description": None
            }
        
        elif current_transaction:
            # Continuation line - append to narration
            # Skip if it looks like a header or page info
            if any(kw in line.lower() for kw in ['page', 'hdfc', 'statement', 'closing balance']):
                continue
            
            clean_line = re.sub(r'[^\w\s\-\./]', ' ', line).strip()
            clean_line = ' '.join(clean_line.split())
            if clean_line and len(clean_line) > 2:
                current_transaction["merchantRaw"] += " " + clean_line[:50]
                current_transaction["merchantRaw"] = current_transaction["merchantRaw"][:150]
    
    # Don't forget last transaction
    if current_transaction:
        transactions.append(current_transaction)
    
    # Sort by date
    transactions.sort(key=lambda x: x["date"])
    
    # Post-process to determine transaction types using Balance Continuity
    # Logic: PrevBalance - Amount = CurrentBalance (Debit)
    #        PrevBalance + Amount = CurrentBalance (Credit)
    
    if len(transactions) > 1:
        # We can deduce types for index 1..N
        for i in range(1, len(transactions)):
            prev_bal = transactions[i-1]["closingBalance"]
            curr_bal = transactions[i]["closingBalance"]
            raw_amts = transactions[i].get("raw_amounts", [])
            
            # Find which amount satisfies the equation
            found_match = False
            for amt in raw_amts[:-1]: # Check all except the last one (which is balance)
                # Check Debit
                if abs(prev_bal - amt - curr_bal) < 1.0:
                    transactions[i]["amount"] = amt
                    transactions[i]["transactionType"] = "debit"
                    found_match = True
                    break
                # Check Credit
                elif abs(prev_bal + amt - curr_bal) < 1.0:
                    transactions[i]["amount"] = amt
                    transactions[i]["transactionType"] = "credit"
                    found_match = True
                    break
            
            if not found_match:
                # Fallback heuristics
                # Look for 'Dr' or 'Cr' in narration
                narration_lower = transactions[i]["merchantRaw"].lower()
                if " cr " in narration_lower or narration_lower.endswith(" cr") or "credit" in narration_lower:
                    transactions[i]["transactionType"] = "credit"
                elif " dr " in narration_lower or narration_lower.endswith(" dr") or "debit" in narration_lower:
                    transactions[i]["transactionType"] = "debit"
                else:
                    # Default based on keywords
                    if any(x in narration_lower for x in ['deposit', 'imps', 'neft cr', 'upi cr']):
                         transactions[i]["transactionType"] = "credit"
                    else:
                         transactions[i]["transactionType"] = "debit"

        # Back-calculate first transaction type if possible
        # Use heuristics for the first one.
        t0 = transactions[0]
        narration_lower = t0["merchantRaw"].lower()
        if t0["transactionType"] == "unknown":
             if any(x in narration_lower for x in ['deposit', 'imps', 'neft cr', 'upi cr', 'credit']):
                 t0["transactionType"] = "credit"
             else:
                 t0["transactionType"] = "debit"
                 
        # Ensure 'amount' is set for t0 if it was just 0.0
        if t0["amount"] == 0 and len(t0.get("raw_amounts", [])) >= 2:
             t0["amount"] = t0["raw_amounts"][0]

    elif len(transactions) == 1:
         # Only one transaction, can't use balance logic
         t0 = transactions[0]
         narration_lower = t0["merchantRaw"].lower()
         if any(x in narration_lower for x in ['deposit', 'imps', 'neft cr', 'upi cr', 'credit']):
             t0["transactionType"] = "credit"
         else:
             t0["transactionType"] = "debit"
         if t0["amount"] == 0 and len(t0.get("raw_amounts", [])) >= 2:
             t0["amount"] = t0["raw_amounts"][0]

    # Cleanup internal fields
    for t in transactions:
        if "raw_amounts" in t:
            del t["raw_amounts"]
    
    # Validations: Extract Dr Court / Cr Count from footer
    # HDFC Footer example: "Total Dr Count : 55 Total Cr Count : 5"
    validation = {
        "expectedDrCount": 0,
        "expectedCrCount": 0,
        "foundFooter": False
    }
    
    try:
        dr_count_matches = re.findall(r'Total\s+Dr\s+Count\s*[:\.]?\s*(\d+)', text, re.IGNORECASE)
        cr_count_matches = re.findall(r'Total\s+Cr\s+Count\s*[:\.]?\s*(\d+)', text, re.IGNORECASE)
        
        if dr_count_matches:
            validation["expectedDrCount"] = int(dr_count_matches[-1]) # Use last occurrence (summary)
            validation["foundFooter"] = True
            
        if cr_count_matches:
            validation["expectedCrCount"] = int(cr_count_matches[-1])
            validation["foundFooter"] = True
            
    except Exception as e:
        print(f"Validation extraction error: {e}")

    # Log summary for debugging
    if transactions:
        print(f"Parsed {len(transactions)} transactions")
        print(f"Date range: {transactions[0]['date']} to {transactions[-1]['date']}")
        print(f"Final balance: {transactions[-1].get('closingBalance', 0)}")
        print(f"Validation: Expected Dr={validation['expectedDrCount']}, Cr={validation['expectedCrCount']}")
    
    return transactions, validation


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "docling_available": DOCLING_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/process")
async def process_document(
    file: UploadFile = File(...),
    password: Optional[str] = Form(default=None)
):
    """
    Process a document (PDF, image, CSV) and extract transactions.
    Uses Docling when available, falls back to simple extraction.
    Supports password-protected PDFs when password is provided.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
    allowed_types = [
        "application/pdf",
        "text/csv", 
        "image/png", 
        "image/jpeg",
        "image/jpg",
        "text/plain"
    ]
    
    content_type = file.content_type or ""
    filename = file.filename or "unknown"
    
    # Check by extension if content_type is unclear
    ext = Path(filename).suffix.lower()
    
    # Save file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        extracted_text = ""
        transactions = []
        processing_method = "fallback"
        decrypted_tmp_path = None  # Track decrypted file for cleanup
        
        # Handle password-protected PDFs
        file_to_process = tmp_path
        if ext == '.pdf' and password:
            decrypted_path, success, error_msg = decrypt_pdf(tmp_path, password)
            if not success:
                raise HTTPException(status_code=400, detail=error_msg)
            if decrypted_path != tmp_path:
                file_to_process = decrypted_path
                decrypted_tmp_path = decrypted_path  # Track for cleanup
        
        # Initialize validation default
        validation = {
            "expectedDrCount": 0,
            "expectedCrCount": 0,
            "foundFooter": False
        }

        if ext == '.pdf':
            # STRATEGY 1: Financial-Grade Fast Path (Balance Spine)
            try:
                print("Attempting Fast Balance Spine Extraction...")
                from fast_parser import parse_pdf_fast
                transactions, validation = parse_pdf_fast(file_to_process)
                
                if transactions and len(transactions) > 0:
                    processing_method = "fast_spine"
                    extracted_text = "(Math-Verified Balance Spine Extraction)"
                    print(f"✅ Fast Path Succeeded: {len(transactions)} txns")
                else:
                    raise Exception("Fast path returned no transactions")
            except Exception as fast_err:
                print(f"⚠️ Fast Path Failed: {fast_err}")
                
                # STRATEGY 2: Visual Layout Fallback (Slow Path)
                try:
                    print("Falling back to Slow Visual Extraction...")
                    from slow_parser import parse_pdf_slow
                    transactions, validation = parse_pdf_slow(file_to_process)
                    processing_method = "pdfplumber_visual"
                    extracted_text = "(Visual Extraction Performed)"
                    
                    if not transactions:
                        raise Exception("Visual extraction returned 0 transactions")
                        
                except Exception as slow_err:
                    print(f"❌ Slow Path Failed: {slow_err}")
                    
                    # STRATEGY 3: Last Resort (Text/OCR)
                    extracted_text = extract_text_simple(file_to_process)
                    if extracted_text and len(extracted_text.strip()) > 100:
                        processing_method = "pypdf_fallback"
                        transactions, validation = parse_transactions_from_text(extracted_text)
                    elif DOCLING_AVAILABLE and DOCLING_CONVERTER:
                        try:
                            print(f"PDF has no extractable text, using Docling OCR...")
                            result = DOCLING_CONVERTER.convert(file_to_process)
                            extracted_text = result.document.export_to_markdown()
                            processing_method = "docling"
                            transactions, validation = parse_transactions_from_text(extracted_text)
                        except Exception as de:
                            print(f"Docling error: {de}")
                    else:
                        processing_method = "failed"
        
        elif ext in ['.png', '.jpg', '.jpeg']:
            # Images always need OCR via Docling
            if DOCLING_AVAILABLE and DOCLING_CONVERTER:
                try:
                    result = DOCLING_CONVERTER.convert(file_to_process)
                    extracted_text = result.document.export_to_markdown()
                    processing_method = "docling"
                    transactions, validation = parse_transactions_from_text(extracted_text)
                except Exception as e:
                    print(f"Docling error on image: {e}")
                    extracted_text = ""
            else:
                extracted_text = ""
        else:
            # CSV/text files - simple extraction
            extracted_text = extract_text_simple(file_to_process)
            processing_method = "text"
            transactions, validation = parse_transactions_from_text(extracted_text)
        
        # DEBUG: Log extracted text sample
        print(f"=== EXTRACTED TEXT ({len(extracted_text)} chars) ===")
        print(extracted_text[:2000] if len(extracted_text) > 2000 else extracted_text)
        print("=== END SAMPLE ===")
        
        # Calculate actual counts for comparison
        actual_dr = sum(1 for t in transactions if t.get('transactionType') == 'debit')
        actual_cr = sum(1 for t in transactions if t.get('transactionType') == 'credit')
        
        # Normalize validation dict (fast_parser has different structure)
        expected_dr = validation.get("expectedDrCount", 0)
        expected_cr = validation.get("expectedCrCount", 0)
        found_footer = validation.get("foundFooter", False)
        
        return {
            "success": True,
            "filename": filename,
            "processingMethod": processing_method,
            "extractedText": extracted_text[:5000] if len(extracted_text) > 5000 else extracted_text,
            "transactions": transactions,
            "transactionCount": len(transactions),
            "validation": {
                "expectedDrCount": expected_dr,
                "expectedCrCount": expected_cr,
                "actualDrCount": actual_dr,
                "actualCrCount": actual_cr,
                "foundFooter": found_footer,
                "matches": (expected_dr == actual_dr and expected_cr == actual_cr) if found_footer else None,
                "method": validation.get("method", processing_method)
            },
            "message": f"Extracted {len(transactions)} transactions using {processing_method}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    
    finally:
        # Cleanup temp files
        try:
            os.unlink(tmp_path)
        except:
            pass
        # Also cleanup decrypted temp file if it exists
        if decrypted_tmp_path:
            try:
                os.unlink(decrypted_tmp_path)
            except:
                pass


@app.post("/api/export/csv")
async def export_csv(transactions: list):
    """Export transactions to CSV format"""
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Date', 'Merchant', 'Amount', 'Type', 'Category', 'Notes'])
    
    # Data
    for tx in transactions:
        writer.writerow([
            tx.get('date', ''),
            tx.get('merchantNormalized', tx.get('merchantRaw', '')),
            tx.get('amount', 0),
            tx.get('transactionType', 'debit'),
            tx.get('category', ''),
            tx.get('notes', '')
        ])
    
    return JSONResponse(
        content={"csv": output.getvalue()},
        media_type="application/json"
    )


# Serve React frontend static files
FRONTEND_DIR = Path(__file__).parent / "static"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React frontend for all non-API routes"""
        file_path = FRONTEND_DIR / full_path
        
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        # Return index.html for SPA routing
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"error": "Frontend not built. Run 'npm run build' in subtrack-local-finance/"}
else:
    @app.get("/")
    async def root():
        return {
            "message": "SubTrack API is running",
            "docs": "/docs",
            "health": "/api/health",
            "note": "Frontend not found. Build the React app and copy to backend/static/"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
