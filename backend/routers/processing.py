from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pathlib import Path
import tempfile
import os
from typing import Optional

from services.parsers import (
    DOCLING_AVAILABLE, 
    DOCLING_CONVERTER, 
    decrypt_pdf, 
    extract_text_simple, 
    parse_transactions_from_text
)

# Import parsers from services (moved from root)
try:
    from services.fast_parser import parse_pdf_fast
except ImportError:
    parse_pdf_fast = None

try:
    from services.slow_parser import parse_pdf_slow
except ImportError:
    parse_pdf_slow = None

router = APIRouter()

@router.post("/process")
async def process_document(
    file: UploadFile = File(...),
    password: Optional[str] = Form(default=None)
):
    """
    Process a document (PDF, image, CSV) and extract transactions.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate file type
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
                if parse_pdf_fast:
                    transactions, validation = parse_pdf_fast(file_to_process)
                    
                    if transactions and len(transactions) > 0:
                        processing_method = "fast_spine"
                        extracted_text = "(Math-Verified Balance Spine Extraction)"
                        print(f"✅ Fast Path Succeeded: {len(transactions)} txns")
                    else:
                        raise Exception("Fast path returned no transactions")
                else:
                    raise Exception("Fast parser module not available")
            except Exception as fast_err:
                print(f"⚠️ Fast Path Failed: {fast_err}")
                
                # STRATEGY 2: Visual Layout Fallback (Slow Path)
                try:
                    print("Falling back to Slow Visual Extraction...")
                    if parse_pdf_slow:
                        transactions, validation = parse_pdf_slow(file_to_process)
                        processing_method = "pdfplumber_visual"
                        extracted_text = "(Visual Extraction Performed)"
                        
                        if not transactions:
                            raise Exception("Visual extraction returned 0 transactions")
                    else:
                        raise Exception("Slow parser module not available")
                        
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
        
        # Log summary for debugging
        print(f"=== EXTRACTED TEXT ({len(extracted_text)} chars) ===")
        print(extracted_text[:2000] if len(extracted_text) > 2000 else extracted_text)
        print("=== END SAMPLE ===")
        
        # Calculate actual counts for comparison
        actual_dr = sum(1 for t in transactions if t.get('transactionType') == 'debit')
        actual_cr = sum(1 for t in transactions if t.get('transactionType') == 'credit')
        
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    
    finally:
        # Cleanup temp files
        try:
            os.unlink(tmp_path)
        except:
            pass
        if decrypted_tmp_path:
            try:
                os.unlink(decrypted_tmp_path)
            except:
                pass
