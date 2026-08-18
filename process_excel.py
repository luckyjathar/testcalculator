import pandas as pd
import os

# तुझ्या इनपुट आणि आउटपुट फाईलचे नाव
INPUT_FILE = "Updated Digital Scheme Chart AUG 26.xlsb"
OUTPUT_FILE = "Extracted_Data_Output.csv"

def process_data():
    print(f"Reading file: {INPUT_FILE}...")
    
    try:
        # सर्व शीट्स वाचणे (.xlsb फाईलसाठी pyxlsb इंजिन वापरले आहे)
        all_sheets = pd.read_excel(INPUT_FILE, sheet_name=None, engine='pyxlsb', header=None)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    final_data = []
    headers = ["SHEET NAME", "CATEGORY", "BRAND", "MODEL", "MRP", "TOTAL TENURE", "ADVANCE EMI", "DBD", "CPF", "VALIDITY", "LOCATION"]
    final_data.append(headers)

    # प्रत्येक शीट प्रोसेस करणे
    for sheet_name, df in all_sheets.items():
        print(f"Processing sheet: {sheet_name}")
        
        # रिकाम्या ओळी आणि कॉलम्स काढणे
        df = df.dropna(how='all') 
        
        # टीप: तुझा मूळ JavaScript मधील जो 'Row/Column शोधण्याचा' लॉजिक आहे, 
        # तो इथून पुढे Pandas वापरून लागू होतो. 
        # उदाहरणासाठी आपण डेटा सरळ CSV मध्ये घेत आहोत:
        for index, row in df.iterrows():
            # जिथे काहीतरी Value आहे तीच रो आपण घेणार (तुझ्या आधीच्या अटीनुसार)
            row_data = [str(cell).strip() if pd.notna(cell) else "" for cell in row]
            
            # जर रो पूर्ण रिकामी नसेल, तर रिझल्टमध्ये टाकणे
            if any(row_data):
                # शीटचे नाव पहिल्या कॉलममध्ये जोडले
                final_data.append([sheet_name] + row_data[:10]) # पहिल्या 10 व्हॅल्यूज

    # डेटा CSV मध्ये सेव्ह करणे
    out_df = pd.DataFrame(final_data)
    out_df.to_csv(OUTPUT_FILE, index=False, header=False, encoding='utf-8-sig')
    print(f"Success! Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    if os.path.exists(INPUT_FILE):
        process_data()
    else:
        print(f"File {INPUT_FILE} not found!")
