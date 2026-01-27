import re
import os
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Dict, Any, Optional

# PDF password handling
try:
    from pypdf import PdfReader, PdfWriter
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False
    print("⚠️ pypdf not available - password-protected PDFs won't be supported")

# Docling configuration
DOCLING_AVAILABLE = False
DOCLING_CONVERTER = None

def get_docling_converter():
    """Lazy loader for Docling converter"""
    global DOCLING_CONVERTER, DOCLING_AVAILABLE
    
    if DOCLING_CONVERTER is not None:
        return DOCLING_CONVERTER
        
    try:
        import multiprocessing
        # Set thread count via environment variable for underlying libraries
        cpu_count = multiprocessing.cpu_count()
        os.environ.setdefault('OMP_NUM_THREADS', str(cpu_count))
        os.environ.setdefault('DOCLING_NUM_THREADS', str(cpu_count))
        
        from docling.document_converter import DocumentConverter, PdfFormatOption
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
        return DOCLING_CONVERTER
        
    except ImportError as e:
        print(f"⚠️ Docling not available: {e}")
        print("   Install with: pip install docling")
        return None
    except Exception as e:
        print(f"⚠️ Docling configuration error: {e}")
        print("   Will use fallback text extraction")
        return None


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


def decrypt_pdf(file_path: str, password: str) -> Tuple[str, bool, str]:
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


def parse_transactions_from_text(text: str) -> Tuple[List[Dict], Dict]:
    """
    Parse transactions from HDFC Bank statement text.
    Expected columns: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
    """
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
    
    # Amount pattern - must have decimal point with 1 or 2 digits
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
            
            # Remove value date
            rest_of_line = re.sub(r'\d{1,2}/\d{1,2}/\d{2,4}', ' ', rest_of_line)
            
            # Find all amounts with decimal point
            amounts = re.findall(amount_pattern, rest_of_line)
            
            # Filter out small amounts that are likely not transactions
            amounts = [a for a in amounts if float(a.replace(',', '')) >= 0.01]
            
            closing_balance = 0.0
            amount_val = 0.0
            
            # The last amount with decimal is usually the closing balance
            if len(amounts) >= 2:
                try:
                    closing_balance = float(amounts[-1].replace(',', ''))
                except:
                    pass
            
            # The amount before specific balance-candidates could be the transaction amount
            if len(amounts) >= 1:
                try:
                    amount_val = float(amounts[0].replace(',', ''))
                except:
                    pass
            
            # Extract narration
            narration = rest_of_line
            for amt in amounts:
                narration = narration.replace(amt, '')
            narration = re.sub(r'[^\w\s\-\./]', ' ', narration).strip()
            # Clean up extra spaces
            narration = ' '.join(narration.split())[:100]
            
            if not narration or len(narration) < 3:
                narration = "Transaction"
            
            # Store raw values for now
            current_transaction = {
                "date": iso_date,
                "merchantRaw": narration,
                "amount": amount_val,
                "raw_amounts": [float(a.replace(',', '')) for a in amounts],
                "transactionType": "unknown", # To be determined
                "paymentMethod": "UPI" if "upi" in narration.lower() else "Other",
                "closingBalance": closing_balance,
                "confidenceScore": 85,
                "description": None
            }
        
        elif current_transaction:
            # Continuation line
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
    if len(transactions) > 1:
        for i in range(1, len(transactions)):
            prev_bal = transactions[i-1]["closingBalance"]
            curr_bal = transactions[i]["closingBalance"]
            raw_amts = transactions[i].get("raw_amounts", [])
            
            found_match = False
            for amt in raw_amts[:-1]:
                if abs(prev_bal - amt - curr_bal) < 1.0:
                    transactions[i]["amount"] = amt
                    transactions[i]["transactionType"] = "debit"
                    found_match = True
                    break
                elif abs(prev_bal + amt - curr_bal) < 1.0:
                    transactions[i]["amount"] = amt
                    transactions[i]["transactionType"] = "credit"
                    found_match = True
                    break
            
            if not found_match:
                narration_lower = transactions[i]["merchantRaw"].lower()
                if " cr " in narration_lower or narration_lower.endswith(" cr") or "credit" in narration_lower:
                    transactions[i]["transactionType"] = "credit"
                elif " dr " in narration_lower or narration_lower.endswith(" dr") or "debit" in narration_lower:
                    transactions[i]["transactionType"] = "debit"
                else:
                    if any(x in narration_lower for x in ['deposit', 'imps', 'neft cr', 'upi cr']):
                         transactions[i]["transactionType"] = "credit"
                    else:
                         transactions[i]["transactionType"] = "debit"

        t0 = transactions[0]
        narration_lower = t0["merchantRaw"].lower()
        if t0["transactionType"] == "unknown":
             if any(x in narration_lower for x in ['deposit', 'imps', 'neft cr', 'upi cr', 'credit']):
                 t0["transactionType"] = "credit"
             else:
                 t0["transactionType"] = "debit"
                 
        if t0["amount"] == 0 and len(t0.get("raw_amounts", [])) >= 2:
             t0["amount"] = t0["raw_amounts"][0]

    elif len(transactions) == 1:
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
    
    # Validations
    validation = {
        "expectedDrCount": 0,
        "expectedCrCount": 0,
        "foundFooter": False
    }
    
    try:
        dr_count_matches = re.findall(r'Total\s+Dr\s+Count\s*[:\.]?\s*(\d+)', text, re.IGNORECASE)
        cr_count_matches = re.findall(r'Total\s+Cr\s+Count\s*[:\.]?\s*(\d+)', text, re.IGNORECASE)
        
        if dr_count_matches:
            validation["expectedDrCount"] = int(dr_count_matches[-1]) 
            validation["foundFooter"] = True
            
        if cr_count_matches:
            validation["expectedCrCount"] = int(cr_count_matches[-1])
            validation["foundFooter"] = True
            
    except Exception as e:
        print(f"Validation extraction error: {e}")
    
    return transactions, validation
