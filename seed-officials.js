// यह स्क्रिप्ट सारे DC (level 3) अधिकारियों को एक साथ डेटाबेस में डाल देगी
// चलाने का तरीका: पहले server.js चालू रखो (node server.js), फिर दूसरे टर्मिनल में:
//   node seed-officials.js
//
// ✅ पूरे 22/22 ज़िले कवर — Ambala के साथ पूरी लिस्ट पूरी हो गई

const officials = [
  { level: 3, department: "DC/SDM", name: "DC Ambala", email: "dcamb@hry.nic.in", phone: "01712530100", district: "Ambala" },
  { level: 3, department: "DC/SDM", name: "Mandeep Kaur", email: "dc.charkhidadri-hry@gov.in", phone: "01250222600", district: "Charkhi Dadri" },
  { level: 3, department: "DC/SDM", name: "Sahil Gupta", email: "dcbhw@hry.nic.in", phone: "01664243535", district: "Bhiwani" },
  { level: 3, department: "DC/SDM", name: "DC Karnal", email: "dckrl@hry.nic.in", phone: "01842267500", district: "Karnal" },
  { level: 3, department: "DC/SDM", name: "DC Kaithal", email: "dcktl@hry.nic.in", phone: "01746234208", district: "Kaithal" },
  { level: 3, department: "DC/SDM", name: "DC Fatehabad", email: "dcftb@hry.nic.in", phone: "016672230001", district: "Fatehabad" },
  { level: 3, department: "DC/SDM", name: "Dr. Vaishali Sharma", email: "dcjnd@hry.nic.in", phone: "1681246820", district: "Jind" },
  { level: 3, department: "DC/SDM", name: "DC Jhajjar", email: "dcjjr@hry.nic.in", phone: "01251252300", district: "Jhajjar" },
  { level: 3, department: "DC/SDM", name: "DC Hansi", email: "dc-hansi@hry.gov.in", phone: "01663258888", district: "Hansi" },
  { level: 3, department: "DC/SDM", name: "Uttam Singh", email: "dcgrg@hry.nic.in", phone: "01242321144", district: "Gurugram" },
  { level: 3, department: "DC/SDM", name: "DC Faridabad", email: "dcfbd@hry.nic.in", phone: "01292227936", district: "Faridabad" },
  { level: 3, department: "DC/SDM", name: "Dr. Harish Kumar Vashishth", email: "dcpnp@hry.nic.in", phone: "01802651502", district: "Panipat" },
  { level: 3, department: "DC/SDM", name: "DC Panchkula", email: "dcpkl@hry.nic.in", phone: "01722585000", district: "Panchkula" },
  { level: 3, department: "DC/SDM", name: "DC Palwal", email: "dcpwl@hry.nic.in", phone: "01275298051", district: "Palwal" },
  { level: 3, department: "DC/SDM", name: "Akhil Pilani", email: "dcnuh@hry.nic.in", phone: "01267274602", district: "Nuh" },
  { level: 3, department: "DC/SDM", name: "Anupama Anjali", email: "dcnrl@hry.nic.in", phone: "01282254000", district: "Mahendragarh" },
  { level: 3, department: "DC/SDM", name: "Vishram Kumar Meena", email: "dckrk@hry.nic.in", phone: "01744220270", district: "Kurukshetra" },
  { level: 3, department: "DC/SDM", name: "DC Hisar", email: "dchsr@hry.nic.in", phone: "01662232045", district: "Hisar" },
  { level: 3, department: "DC/SDM", name: "DC Yamunanagar", email: "dcynr@hry.nic.in", phone: "01732237800", district: "Yamunanagar" },
  { level: 3, department: "DC/SDM", name: "DC Sonipat", email: "dcsnp@hry.nic.in", phone: "01302220500", district: "Sonipat" },
  { level: 3, department: "DC/SDM", name: "Shantanu Sharma", email: "dcsrs@hry.nic.in", phone: "01666248770", district: "Sirsa" },
  { level: 3, department: "DC/SDM", name: "Satbir Singh", email: "dcroh@hry.nic.in", phone: "01262250252", district: "Rohtak" },
  { level: 3, department: "DC/SDM", name: "Abhishek Meena", email: "dcrwr@hry.nic.in", phone: "01274226666", district: "Rewari" },

  // बोनस: SDM/ADC स्तर के अधिकारी (level 2 जैसा उदाहरण — असल BDO डेटा अलग से चाहिए)
  
];
const bdpoData = [
  // Ambala[cite: 1]
  { level: 2, department: "BDO", name: "BDO Ambala-I", email: "bdpo.ambala_city@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Ambala-I" },
  { level: 2, department: "BDO", name: "BDO Ambala-II", email: "bdpo.ambala_cantt@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Ambala-II" },
  { level: 2, department: "BDO", name: "BDO Barara", email: "bdpo.barara@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Barara" },
  { level: 2, department: "BDO", name: "BDO Naraingarh", email: "bdpo.naraingarh@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Naraingarh" },
  { level: 2, department: "BDO", name: "BDO Saha", email: "bdpo.saha@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Saha" },
  { level: 2, department: "BDO", name: "BDO Shahzadpur", email: "bdpo.shehzadpur@hry.nic.in", phone: "0000000000", district: "Ambala", block: "Shahzadpur" },

  // Bhiwani[cite: 1]
  { level: 2, department: "BDO", name: "BDO Badhra", email: "bdpobadhra@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Badhra" },
  { level: 2, department: "BDO", name: "BDO Bawani Khera", email: "bdpobkhera@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Bawani Khera" },
  { level: 2, department: "BDO", name: "BDO Behal", email: "bdpobehal@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Behal" },
  { level: 2, department: "BDO", name: "BDO Bhiwani", email: "bdpobhiwani@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Bhiwani" },
  { level: 2, department: "BDO", name: "BDO Dadri-I", email: "bdpocharkhidadri@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Dadri-I" },
  { level: 2, department: "BDO", name: "BDO Dadri-II", email: "bdpodadri2@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Dadri-II" },
  { level: 2, department: "BDO", name: "BDO Kairu", email: "bdpokairu@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Kairu" },
  { level: 2, department: "BDO", name: "BDO Loharu", email: "bdpoloharu@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Loharu" },
  { level: 2, department: "BDO", name: "BDO Siwani", email: "bdposiwani@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Siwani" },
  { level: 2, department: "BDO", name: "BDO Tosham", email: "bdpotosham@gmail.com", phone: "0000000000", district: "Bhiwani", block: "Tosham" },

  // Faridabad[cite: 1, 2]
  { level: 2, department: "BDO", name: "BDO Ballabgarh", email: "bdpoball129@gmail.com", phone: "0000000000", district: "Faridabad", block: "Ballabgarh" },
  { level: 2, department: "BDO", name: "BDO Faridabad", email: "bdpo.faridabad@gmail.com", phone: "0000000000", district: "Faridabad", block: "Faridabad" },

  // Fatehabad[cite: 2]
  { level: 2, department: "BDO", name: "BDO Bhattu", email: "bdpo.bhattukalan@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Bhattu" },
  { level: 2, department: "BDO", name: "BDO Bhuna", email: "bdpo.bhuna@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Bhuna" },
  { level: 2, department: "BDO", name: "BDO Fatehabad", email: "bdpo.fatehabad@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Fatehabad" },
  { level: 2, department: "BDO", name: "BDO Jakhal", email: "bdpo.jakhal@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Jakhal" },
  { level: 2, department: "BDO", name: "BDO Ratia", email: "bdpo.ratia@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Ratia" },
  { level: 2, department: "BDO", name: "BDO Tohana", email: "bdpo.tohana@hry.nic.in", phone: "0000000000", district: "Fatehabad", block: "Tohana" },
  { level: 2, department: "BDO", name: "BDO Nagpur", email: "bdponagpur@gmail.com", phone: "0000000000", district: "Fatehabad", block: "Nagpur" },

  // Gurgaon[cite: 2]
  { level: 2, department: "BDO", name: "BDO Farrukhnagar", email: "bdpo.farrukhnagar@hry.nic.in", phone: "0000000000", district: "Gurgaon", block: "Farrukhnagar" },
  { level: 2, department: "BDO", name: "BDO Gurgaon", email: "bdpo.gurgaon@hry.nic.in", phone: "0000000000", district: "Gurgaon", block: "Gurgaon" },
  { level: 2, department: "BDO", name: "BDO Pataudi", email: "bdpo.pataudi@hry.nic.in", phone: "0000000000", district: "Gurgaon", block: "Pataudi" },
  { level: 2, department: "BDO", name: "BDO Sohna", email: "bdpo.sohna85@gmail.com", phone: "0000000000", district: "Gurgaon", block: "Sohna" },

  // Hisar[cite: 2, 3]
  { level: 2, department: "BDO", name: "BDO Adampur", email: "bdpo.adampur@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Adampur" },
  { level: 2, department: "BDO", name: "BDO Agroha", email: "bdpo.agroha@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Agroha" },
  { level: 2, department: "BDO", name: "BDO Barwala", email: "bdpo.barwalahsr@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Barwala" },
  { level: 2, department: "BDO", name: "BDO Hansi-I", email: "vishalbhatti92@gmail.com", phone: "0000000000", district: "Hisar", block: "Hansi-I" },
  { level: 2, department: "BDO", name: "BDO Hansi-II", email: "bdpo.hansi@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Hansi-II" },
  { level: 2, department: "BDO", name: "BDO Hisar-I", email: "bdpo.hisar1@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Hisar-I" },
  { level: 2, department: "BDO", name: "BDO Hisar-II", email: "bdpo.hisar2@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Hisar-II" },
  { level: 2, department: "BDO", name: "BDO Narnaund", email: "bdpo.narnaund@gmail.com", phone: "0000000000", district: "Hisar", block: "Narnaund" },
  { level: 2, department: "BDO", name: "BDO Uklana", email: "bdpo.uklana_mandi@hry.nic.in", phone: "0000000000", district: "Hisar", block: "Uklana" },

  // Jhajjar[cite: 3]
  { level: 2, department: "BDO", name: "BDO Bahadurgarh", email: "bdbdp.jhajjar@gmail.com", phone: "0000000000", district: "Jhajjar", block: "Bahadurgarh" },
  { level: 2, department: "BDO", name: "BDO Beri", email: "bdpoberi@gmail.com", phone: "0000000000", district: "Jhajjar", block: "Beri" },
  { level: 2, department: "BDO", name: "BDO Jhajjar", email: "bdbdp.jhajjar@gmail.com", phone: "0000000000", district: "Jhajjar", block: "Jhajjar" },
  { level: 2, department: "BDO", name: "BDO Matanhail", email: "bdpomatanhail@gmail.com", phone: "0000000000", district: "Jhajjar", block: "Matanhail" },
  { level: 2, department: "BDO", name: "BDO Sahlawas", email: "bdposahlawas@gmail.com", phone: "0000000000", district: "Jhajjar", block: "Sahlawas" },

  // Jind[cite: 3]
  { level: 2, department: "BDO", name: "BDO Alewa", email: "bdpo.alewa@hry.nic.in", phone: "0000000000", district: "Jind", block: "Alewa" },
  { level: 2, department: "BDO", name: "BDO Jind", email: "bdpo.jind@hry.nic.in", phone: "0000000000", district: "Jind", block: "Jind" },
  { level: 2, department: "BDO", name: "BDO Julana", email: "bdpo.alewa@hry.nic.in", phone: "0000000000", district: "Jind", block: "Julana" },
  { level: 2, department: "BDO", name: "BDO Narwana", email: "bdpo.narwana@hry.nic.in", phone: "0000000000", district: "Jind", block: "Narwana" },
  { level: 2, department: "BDO", name: "BDO Pillu Khera", email: "bdpo.pillukhera@hry.nic.in", phone: "0000000000", district: "Jind", block: "Pillu Khera" },
  { level: 2, department: "BDO", name: "BDO Safidon", email: "bdpo.safidon@hry.nic.in", phone: "0000000000", district: "Jind", block: "Safidon" },
  { level: 2, department: "BDO", name: "BDO Uchana", email: "bdpo.uchana@hry.nic.in", phone: "0000000000", district: "Jind", block: "Uchana" },

  // Kaithal[cite: 3]
  { level: 2, department: "BDO", name: "BDO Guhla", email: "bdpoguhlacheeka@gmail.com", phone: "0000000000", district: "Kaithal", block: "Guhla" },
  { level: 2, department: "BDO", name: "BDO Kaithal", email: "bdpokaithal@gmail.com", phone: "0000000000", district: "Kaithal", block: "Kaithal" },
  { level: 2, department: "BDO", name: "BDO Kalayat", email: "kalayatbdpo@gmail.com", phone: "0000000000", district: "Kaithal", block: "Kalayat" },
  { level: 2, department: "BDO", name: "BDO Rajaund", email: "bdpo.rajound@hry.nic.in", phone: "0000000000", district: "Kaithal", block: "Rajaund" },
  { level: 2, department: "BDO", name: "BDO Siwan", email: "bdposiwan@gmail.com", phone: "0000000000", district: "Kaithal", block: "Siwan" },

  // Karnal[cite: 3, 4]
  { level: 2, department: "BDO", name: "BDO Karnal", email: "bdpo.karnal@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Karnal" },
  { level: 2, department: "BDO", name: "BDO Indri", email: "bdpo.indri@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Indri" },
  { level: 2, department: "BDO", name: "BDO Nissing", email: "bdpo.nising@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Nissing" },
  { level: 2, department: "BDO", name: "BDO Gharaunda", email: "bdpo.gharaunda@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Gharaunda" },
  { level: 2, department: "BDO", name: "BDO Assandh", email: "bdpo.assandh@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Assandh" },
  { level: 2, department: "BDO", name: "BDO Nilokheri", email: "bdpo.nilokheri@hry.nic.in", phone: "0000000000", district: "Karnal", block: "Nilokheri" },

  // Kurukshetra[cite: 4]
  { level: 2, department: "BDO", name: "BDO Babain", email: "bdpo.babain@hry.nic.in", phone: "0000000000", district: "Kurukshetra", block: "Babain" },
  { level: 2, department: "BDO", name: "BDO Ismailabad", email: "bdpo.ismailabad@hry.nic.in", phone: "0000000000", district: "Kurukshetra", block: "Ismailabad" },
  { level: 2, department: "BDO", name: "BDO Ladwa", email: "bdpoladwakkr@yahoo.co.in", phone: "0000000000", district: "Kurukshetra", block: "Ladwa" },
  { level: 2, department: "BDO", name: "BDO Pehowa", email: "bdpo.pehowa@hry.nic.in", phone: "0000000000", district: "Kurukshetra", block: "Pehowa" },
  { level: 2, department: "BDO", name: "BDO Shahbad", email: "bdpo.shahabad@hry.nic.in", phone: "0000000000", district: "Kurukshetra", block: "Shahbad" },
  { level: 2, department: "BDO", name: "BDO Thanesar", email: "bdpo.thanesar@hry.nic.in", phone: "0000000000", district: "Kurukshetra", block: "Thanesar" },

  // Mewat (Nuh)[cite: 4]
  { level: 2, department: "BDO", name: "BDO F. Jhirka", email: "bdpojhirka@gmail.com", phone: "0000000000", district: "Mewat", block: "F. Jhirka" },
  { level: 2, department: "BDO", name: "BDO Nagina", email: "naginabdpo@gmail.com", phone: "0000000000", district: "Mewat", block: "Nagina" },
  { level: 2, department: "BDO", name: "BDO Nuh", email: "nuhbdpo@gmail.com", phone: "0000000000", district: "Mewat", block: "Nuh" },
  { level: 2, department: "BDO", name: "BDO Punhana", email: "bdpopunhana@gmail.com", phone: "0000000000", district: "Mewat", block: "Punhana" },
  { level: 2, department: "BDO", name: "BDO Tauru", email: "bdpotauru@gmail.com", phone: "0000000000", district: "Mewat", block: "Tauru" },

  // Mohindergarh[cite: 4, 5]
  { level: 2, department: "BDO", name: "BDO Ateli Nangal", email: "bdpo.ateli_nangal@hry.nic.in", phone: "0000000000", district: "Mohindergarh", block: "Ateli Nangal" },
  { level: 2, department: "BDO", name: "BDO Kanina", email: "bdpo.ateli_nangal@hry.nic.in", phone: "0000000000", district: "Mohindergarh", block: "Kanina" },
  { level: 2, department: "BDO", name: "BDO Mohindergarh", email: "bdpo.mahendragarh@hry.nic.in", phone: "0000000000", district: "Mohindergarh", block: "Mohindergarh" },
  { level: 2, department: "BDO", name: "BDO Nangal Chaudhary", email: "bdpo.nangal_chaudhery@hry.nic.in", phone: "0000000000", district: "Mohindergarh", block: "Nangal Chaudhary" },
  { level: 2, department: "BDO", name: "BDO Narnaul", email: "bdpo.narnaul@hry.nic.in", phone: "0000000000", district: "Mohindergarh", block: "Narnaul" },
  { level: 2, department: "BDO", name: "BDO Nijampur", email: "bdponizampur@gmail.com", phone: "0000000000", district: "Mohindergarh", block: "Nijampur" },
  { level: 2, department: "BDO", name: "BDO Satnali", email: "satnalibdpo@gmail.com", phone: "0000000000", district: "Mohindergarh", block: "Satnali" },
  { level: 2, department: "BDO", name: "BDO Sihma", email: "bdpo.sihma@gmail.com", phone: "0000000000", district: "Mohindergarh", block: "Sihma" },

  // Palwal[cite: 5]
  { level: 2, department: "BDO", name: "BDO Hassanpur", email: "bdpohassanpur@gmail.com", phone: "0000000000", district: "Palwal", block: "Hassanpur" },
  { level: 2, department: "BDO", name: "BDO Hathin", email: "bdpo.hathin@hry.nic.in", phone: "0000000000", district: "Palwal", block: "Hathin" },
  { level: 2, department: "BDO", name: "BDO Hodal", email: "bdpo.hodal@hry.nic.in", phone: "0000000000", district: "Palwal", block: "Hodal" },
  { level: 2, department: "BDO", name: "BDO Palwal", email: "bdpopalwal@gmail.com", phone: "0000000000", district: "Palwal", block: "Palwal" },
  { level: 2, department: "BDO", name: "BDO Prithla", email: "bdpo.prithla@gmail.com", phone: "0000000000", district: "Palwal", block: "Prithla" },

  // Panchkula[cite: 5]
  { level: 2, department: "BDO", name: "BDO Barwala", email: "bdpobarwala@gmail.com", phone: "0000000000", district: "Panchkula", block: "Barwala" },
  { level: 2, department: "BDO", name: "BDO Morni", email: "bdpomorni1@yahoo.com", phone: "0000000000", district: "Panchkula", block: "Morni" },
  { level: 2, department: "BDO", name: "BDO Pinjore", email: "bdpopinjore@gmail.com", phone: "0000000000", district: "Panchkula", block: "Pinjore" },
  { level: 2, department: "BDO", name: "BDO Raipur Rani", email: "bdpo.raipur_rani@hry.nic.in", phone: "0000000000", district: "Panchkula", block: "Raipur Rani" },

  // Panipat[cite: 5, 6]
  { level: 2, department: "BDO", name: "BDO Bapoli", email: "bdpo.bapoli@hry.nic.in", phone: "0000000000", district: "Panipat", block: "Bapoli" },
  { level: 2, department: "BDO", name: "BDO Sanoli Khurd", email: "bdpo.sanaulikhrd-hry@gov.in", phone: "0000000000", district: "Panipat", block: "Sanoli Khurd" },
  { level: 2, department: "BDO", name: "BDO Israna", email: "bdpo.israna@hry.nic.in", phone: "0000000000", district: "Panipat", block: "Israna" },
  { level: 2, department: "BDO", name: "BDO Samalkha", email: "bdpo.samalkha@hry.nic.in", phone: "0000000000", district: "Panipat", block: "Samalkha" },
  { level: 2, department: "BDO", name: "BDO Panipat", email: "bdpo.panipat@hry.nic.in", phone: "0000000000", district: "Panipat", block: "Panipat" },
  { level: 2, department: "BDO", name: "BDO Madloda", email: "bdpo.matloda@hry.nic.in", phone: "0000000000", district: "Panipat", block: "Madloda" },

  // Rewari[cite: 6]
  { level: 2, department: "BDO", name: "BDO Jatusana", email: "bdpojatusana@rediffmail.com", phone: "0000000000", district: "Rewari", block: "Jatusana" },
  { level: 2, department: "BDO", name: "BDO Khol", email: "bdpokhol@gmail.com", phone: "0000000000", district: "Rewari", block: "Khol" },
  { level: 2, department: "BDO", name: "BDO Nahar", email: "bdponahar@gmail.com", phone: "0000000000", district: "Rewari", block: "Nahar" },
  { level: 2, department: "BDO", name: "BDO Rewari", email: "bdporewari@gmail.com", phone: "0000000000", district: "Rewari", block: "Rewari" },
  { level: 2, department: "BDO", name: "BDO Dahina", email: "bdpodahina@gmail.com", phone: "0000000000", district: "Rewari", block: "Dahina" },

  // Rohtak[cite: 6]
  { level: 2, department: "BDO", name: "BDO Kalanaur", email: "bdpokalanaur1@gmail.com", phone: "0000000000", district: "Rohtak", block: "Kalanaur" },
  { level: 2, department: "BDO", name: "BDO Lakhan Majra", email: "bdpo.lakhan_majra@hry.nic.in", phone: "0000000000", district: "Rohtak", block: "Lakhan Majra" },
  { level: 2, department: "BDO", name: "BDO Meham", email: "bdpo.meham@hry.nic.in", phone: "0000000000", district: "Rohtak", block: "Meham" },
  { level: 2, department: "BDO", name: "BDO Rohtak", email: "bdpo.rohtak@hry.nic.in", phone: "0000000000", district: "Rohtak", block: "Rohtak" },
  { level: 2, department: "BDO", name: "BDO Sampla", email: "bdpo.sampla@hry.nic.in", phone: "0000000000", district: "Rohtak", block: "Sampla" },

  // Sirsa[cite: 6]
  { level: 2, department: "BDO", name: "BDO Baragudha", email: "bdpobrg@gmail.com", phone: "0000000000", district: "Sirsa", block: "Baragudha" },
  { level: 2, department: "BDO", name: "BDO Dabwali", email: "bdpo.dabwali@hry.nic.in", phone: "0000000000", district: "Sirsa", block: "Dabwali" },
  { level: 2, department: "BDO", name: "BDO Ellnabad", email: "bdpo.ellenabad@hry.nic.in", phone: "0000000000", district: "Sirsa", block: "Ellnabad" },
  { level: 2, department: "BDO", name: "BDO Nathusari Chopta", email: "bdpo.chopta@gmail.com", phone: "0000000000", district: "Sirsa", block: "Nathusari Chopta" },
  { level: 2, department: "BDO", name: "BDO Odhan", email: "bdpo.odhan@hry.nic.in", phone: "0000000000", district: "Sirsa", block: "Odhan" },
  { level: 2, department: "BDO", name: "BDO Rania", email: "bdpo.rania@hry.nic.in", phone: "0000000000", district: "Sirsa", block: "Rania" },
  { level: 2, department: "BDO", name: "BDO Sirsa", email: "bdpo.sirsa@gmail.com", phone: "0000000000", district: "Sirsa", block: "Sirsa" },

  // Sonepat[cite: 7]
  { level: 2, department: "BDO", name: "BDO Ganaur", email: "bdpogannaur@gmail.com", phone: "0000000000", district: "Sonepat", block: "Ganaur" },
  { level: 2, department: "BDO", name: "BDO Gohana", email: "bdpogohana@gmail.com", phone: "0000000000", district: "Sonepat", block: "Gohana" },
  { level: 2, department: "BDO", name: "BDO Kathura", email: "bdpokathura6@gmail.com", phone: "0000000000", district: "Sonepat", block: "Kathura" },
  { level: 2, department: "BDO", name: "BDO Kharkhoda", email: "bdpokharkhoda@gmail.com", phone: "0000000000", district: "Sonepat", block: "Kharkhoda" },
  { level: 2, department: "BDO", name: "BDO Mundlana", email: "bdpomundlana@gmail.com", phone: "0000000000", district: "Sonepat", block: "Mundlana" },
  { level: 2, department: "BDO", name: "BDO Murthal", email: "bdpomurthal@gmail.com", phone: "0000000000", district: "Sonepat", block: "Murthal" },
  { level: 2, department: "BDO", name: "BDO Rai", email: "bdporai123@gmail.com", phone: "0000000000", district: "Sonepat", block: "Rai" },
  { level: 2, department: "BDO", name: "BDO Sonepat", email: "bdposnp@gmail.com", phone: "0000000000", district: "Sonepat", block: "Sonepat" },

  // Yamunanagar[cite: 7]
  { level: 2, department: "BDO", name: "BDO Bilaspur", email: "bdpo.bilaspur@hry.nic.in", phone: "0000000000", district: "Yamunanagar", block: "Bilaspur" },
  { level: 2, department: "BDO", name: "BDO Chhachhrauli", email: "bdpo.chhachhrauli@hry.nic.in", phone: "0000000000", district: "Yamunanagar", block: "Chhachhrauli" },
  { level: 2, department: "BDO", name: "BDO Jagadhri", email: "bdpo.jagadhri@hry.nic.in", phone: "0000000000", district: "Yamunanagar", block: "Jagadhri" },
  { level: 2, department: "BDO", name: "BDO Mustfabad", email: "bdpo.mustafabad@hry.nic.in", phone: "0000000000", district: "Yamunanagar", block: "Mustfabad" },
  { level: 2, department: "BDO", name: "BDO Radaur", email: "bdpo.radaur@hry.nic.in", phone: "0000000000", district: "Yamunanagar", block: "Radaur" },
  { level: 2, department: "BDO", name: "BDO Sadhaura", email: "accountant_sad@yahoo.in", phone: "0000000000", district: "Yamunanagar", block: "Sadhaura" }
];

const bodies = [
      // --- राज्य-स्तर के Fallback अधिकारी (जब कोई लोकल अधिकारी न मिले) ---
  { level: 0, department: "जल (PHED)", name: "PHED Helpdesk (राज्य स्तर)", email: "helpdesk-phed@phedharyana.gov.in", phone: "01722583005", district: "राज्य-स्तर" },
  { level: 0, department: "सड़क (PWD)", name: "Executive Engineer General, PWD B&R", email: "pwd-eic@hry.nic.in", phone: "911722618275", district: "राज्य-स्तर" },
  { level: 0, department: "शिक्षा", name: "Directorate of School Education", email: "edusecondaryhry@gmail.com", phone: "01722560269", district: "राज्य-स्तर" },
  { level: 0, department: "राशन/PDS", name: "Food Civil Supplies Dept HQ", email: "foods@hry.nic.in", phone: "018001802405", district: "राज्य-स्तर" },
];

// दोनों लिस्ट को मिला दें
officials.push(...bdpoData);
officials.push(...bodies);
// sarkari sites se verify ki hui emails (ye upar ki purani entries ko overwrite karengi)
officials.push(
  { level: 2, department: 'BDO', name: 'BDO Dhand', email: 'bdpodhand@gmail.com', phone: '01746250438', district: 'Kaithal', block: 'Dhand' },
  { level: 2, department: 'BDO', name: 'BDO Pundri', email: 'bdpo.pundri@gmail.com', phone: '01746270233', district: 'Kaithal', block: 'Pundri' },
  { level: 2, department: 'BDO', name: 'BDO Badli', email: 'bdpo.badli@gmail.com', phone: '01276240298', district: 'Jhajjar', block: 'Badli' },
  { level: 2, department: 'BDO', name: 'BDO Kunjpura', email: 'bdpo.kunjpura@gmail.com', phone: '8684070427', district: 'Karnal', block: 'Kunjpura' },
  { level: 2, department: 'BDO', name: 'BDO Kanina', email: 'bdpo.kanina@hry.nic.in', phone: '01285235135', district: 'Mahendragarh', block: 'Kanina' },
  { level: 2, department: 'BDO', name: 'BDO Satnali', email: 'bdposatnali@gmail.com', phone: '01285231900', district: 'Mahendragarh', block: 'Satnali' },
  { level: 2, department: 'BDO', name: 'BDO Hathin', email: 'hathinbdpo@gmail.com', phone: '0000000000', district: 'Palwal', block: 'Hathin' },
  { level: 2, department: 'BDO', name: 'BDO Prithla', email: 'bdpoprithla1@gmail.com', phone: '0000000000', district: 'Palwal', block: 'Prithla' },
  { level: 2, department: 'BDO', name: 'BDO Hassanpur', email: 'bdpohassanpur@rediffmail.com', phone: '0000000000', district: 'Palwal', block: 'Hassanpur' },
  { level: 2, department: 'BDO', name: 'BDO Hodal', email: 'hodalbdpo@gmail.com', phone: '0000000000', district: 'Palwal', block: 'Hodal' },
  { level: 2, department: 'BDO', name: 'BDO Badhra', email: 'bdpo.badhra@gmail.com', phone: '01252297295', district: 'Charkhi Dadri', block: 'Badhra' },
  { level: 2, department: 'BDO', name: 'BDO Baund', email: 'bdpo.bondkalan@hry.nic.in', phone: '0000000000', district: 'Charkhi Dadri', block: 'Baund' },
  { level: 2, department: 'BDO', name: 'BDO Jhojhu', email: 'bdpo.charkhidadri@hry.gov.in', phone: '0000000000', district: 'Charkhi Dadri', block: 'Jhojhu' },
  { level: 2, department: 'BDO', name: 'BDO Tigaon', email: 'bdpo.tigaon@gmail.com', phone: '0000000000', district: 'Faridabad', block: 'Tigaon' },
  { level: 2, department: 'BDO', name: 'BDO Machhrauli', email: 'bdpomachhrauli@gmail.com', phone: '0000000000', district: 'Jhajjar', block: 'Machhrauli' },
  { level: 2, department: 'BDO', name: 'BDO Ujhana', email: 'bdpo.ujhana@gmail.com', phone: '01684240162', district: 'Jind', block: 'Ujhana' },
  { level: 2, department: 'BDO', name: 'BDO Chirao', email: 'bdpo.nising@hry.nic.in', phone: '01842290242', district: 'Karnal', block: 'Chirao' },
  { level: 2, department: 'BDO', name: 'BDO Munak', email: 'bdpomunak@gmail.com', phone: '0000000000', district: 'Karnal', block: 'Munak' },
  { level: 2, department: 'BDO', name: 'BDO Pipli', email: 'bdpo.pipli@hry.nic.in', phone: '0000000000', district: 'Kurukshetra', block: 'Pipli' },
  { level: 2, department: 'BDO', name: 'BDO Indri', email: 'pingwanbdpo@gmail.com', phone: '0000000000', district: 'Nuh', block: 'Indri' },
  { level: 2, department: 'BDO', name: 'BDO Pingwan', email: 'pingwanbdpo@gmail.com', phone: '0000000000', district: 'Nuh', block: 'Pingwan' },
  { level: 2, department: 'BDO', name: 'BDO Bawal', email: 'bdpo.bawal@hry.nic.in', phone: '0000000000', district: 'Rewari', block: 'Bawal' },
  { level: 2, department: 'BDO', name: 'BDO Dharuhera', email: 'bdpodharuhera@gmail.com', phone: '0000000000', district: 'Rewari', block: 'Dharuhera' },
  { level: 2, department: 'BDO', name: 'BDO Partap Nagar', email: 'khizrabadbdpo1@gmail.com', phone: '0000000000', district: 'Yamunanagar', block: 'Partap Nagar' },
);

// ===== यहाँ से नीचे नया कोड =====
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Official = require('./models/Official');

// आपकी ऐप का असली ज़िले/ब्लॉक/गाँव डेटा
const HR = new Function(fs.readFileSync(path.join(__dirname, 'haryana-data.js'), 'utf8') + '; return haryanaFullData;')();

// सरपंच (ये लिस्ट आप खुद बढ़ाते जाइए)
const sarpanchData = [
  { level: 1, department: 'पंचायत', name: 'Suman', email: 'chk-gpshekhupurdaroli-hr@panchayat.gov.in', phone: '0000000000',
    district: 'Fatehabad', block: 'Bhattu Kalan', village: 'Shekhupur Daroli' },
];

const DISTRICT_ALIAS = { 'Gurgaon': 'Gurugram', 'Mewat': 'Nuh', 'Mohindergarh': 'Mahendragarh', 'Sonepat': 'Sonipat' };
const BLOCK_ALIAS = {
  'F. Jhirka': 'Ferozepur Jhirka',
  'Sanoli Khurd': 'Sanauli Khurd',
  'Madloda': 'Madlauda',
  'Dadri-I': 'Charkhi Dadri',
  'Dadri-II': 'Charkhi Dadri',
  'Sadhaura': 'Sadaura (Part)',
  'Mohindergarh': 'Mahendragarh',
  'Mustfabad': 'Saraswati Nagar',
};

const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length];
}
function fixDistrict(d) {
  d = DISTRICT_ALIAS[d] || d;
  return HR[d] ? d : null;
}
// ब्लॉक का असली नाम ढूँढो (पहले उसी ज़िले में, फिर पूरे हरियाणा में)
function fixBlock(district, block) {
  block = BLOCK_ALIAS[block] || block;
  const target = norm(block);
  const search = (dist) => {
    const names = Object.keys(HR[dist] || {});
    let hit = names.find(n => norm(n) === target);
    if (!hit) hit = names.find(n => norm(n).startsWith(target) || target.startsWith(norm(n)));
    if (!hit) hit = names.find(n => lev(norm(n), target) <= 2);
    return hit ? { district: dist, block: hit } : null;
  };
  let r = district && search(district);
  if (r) return r;
  for (const d of Object.keys(HR)) { r = search(d); if (r) return r; }
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ok = [], skipped = [];

  for (const o0 of officials) {
    const o = { ...o0 };
    if (o.level === 0) {
      await Official.findOneAndUpdate({ level: 0, department: o.department }, o, { upsert: true, new: true });
      ok.push(o.name); continue;
    }
    const dist = fixDistrict(o.district);
    if (!dist) { skipped.push(`${o.name} — ज़िला नहीं मिला: ${o.district}`); continue; }
    o.district = dist;
    const f = { level: o.level, department: o.department, district: dist };
    if (o.level === 2) {
      const fb = fixBlock(dist, o.block);
      if (!fb) { skipped.push(`${o.name} — ब्लॉक नहीं मिला: ${o.district}/${o.block}`); continue; }
      o.district = fb.district; o.block = fb.block;
      f.district = fb.district; f.block = fb.block;
    }
    await Official.findOneAndUpdate(f, o, { upsert: true, new: true });
    ok.push(o.name);
  }

  for (const s of sarpanchData) {
    const villages = (HR[s.district] && HR[s.district][s.block]) || [];
    if (!villages.includes(s.village)) { skipped.push(`${s.name} — गाँव ${s.village} इस ब्लॉक में नहीं है`); continue; }
    const f = { level: 1, department: 'पंचायत', district: s.district, block: s.block, village: s.village };
    await Official.findOneAndUpdate(f, s, { upsert: true, new: true });
    ok.push(s.name);
  }

  console.log(`✅ डाले गए: ${ok.length}`);
  console.log(`⚠️ छोड़े गए: ${skipped.length}`);
  skipped.forEach(x => console.log('   - ' + x));
  process.exit(0);
})();