/**
 * RI Family Visits Survey (Form V / Annex G-7) Schema & Definitions
 * Based directly on "Operational Guidlines RUIP 4.docx", pages 28–40.
 */

export const FAMILY_SURVEY_SECTIONS = [
  {
    key: 'INITIAL',
    code: 'INITIAL',
    title: 'Initial Details',
    subtitle: 'Household identification and demographic details',
    instruction: 'Enter information of first family at Sr. 1 and continue till you complete required families.',
    questions: [
      {
        id: 'family_serial_number',
        sr: '1',
        label: 'Family Serial number',
        type: 'number',
        instruction: 'Enter information of first family at Sr. 1 and continue till you complete 10 families',
        required: true,
        default: 1
      },
      {
        id: 'village_name',
        sr: '1a',
        label: 'Village Name',
        type: 'village_select',
        placeholder: 'Select or enter village name',
        instruction: 'Select or enter the village where this family visit was completed',
        required: true
      },
      {
        id: 'head_of_family_name',
        sr: '2',
        label: 'Name of head of family',
        type: 'text',
        placeholder: 'Full name of decision maker of family',
        instruction: 'Head of family is the person who makes decisions on economic and social matters on behalf of entire family.',
        required: true
      },
      {
        id: 'total_family_members',
        sr: '3',
        label: 'Total number of family members',
        type: 'number',
        min: 1,
        max: 50,
        instruction: 'Enter total number of persons, male / female and of all age groups',
        required: true
      },
      {
        id: 'male_members',
        sr: '3a',
        label: 'Male members',
        type: 'number',
        min: 0,
        max: 30,
        instruction: 'Number of male family members',
        required: false
      },
      {
        id: 'female_members',
        sr: '3b',
        label: 'Female members',
        type: 'number',
        min: 0,
        max: 30,
        instruction: 'Number of female family members',
        required: false
      },
      {
        id: 'respondent_name',
        sr: '3c',
        label: 'Respondent Name (Person Interviewed)',
        type: 'text',
        placeholder: 'Name of family member responding',
        instruction: 'Person currently giving survey answers',
        required: false
      },
      {
        id: 'contact_number',
        sr: '3d',
        label: 'Contact Number',
        type: 'tel',
        placeholder: '10-digit mobile number',
        instruction: 'Phone number for verification if available',
        required: false
      }
    ]
  },
  {
    key: 'A',
    code: 'SECTION A',
    title: 'House Information',
    questions: [
      {
        id: 'a_1_type_of_house',
        sr: '1',
        label: 'Type of house',
        instruction: 'Observe house and enter one of the options',
        required: true,
        options: [
          'Kachcha (Walls with bamboo, mud, stones, etc.)',
          'Semi pakka (mixed)',
          'Pakka (Build with durable material like brick, cement concrete, etc)'
        ]
      },
      {
        id: 'a_2_ownership_of_house',
        sr: '2',
        label: 'Ownership of house',
        instruction: 'Ask if the house they are staying is owned by family - Options are -',
        required: true,
        options: [
          '1) Owned',
          '2) Hired',
          '3) Provided by employer or relative',
          '4) Other'
        ]
      }
    ]
  },
  {
    key: 'B',
    code: 'SECTION B',
    title: 'Amenities Available',
    questions: [
      {
        id: 'b_1_electricity',
        sr: '1',
        label: 'Electricity',
        instruction: 'Ask whether electricity is available in house. Options -',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'b_2_mobile_phones',
        sr: '2',
        label: 'Mobile phones',
        instruction: 'Ask whether family has mobile phone - Options -',
        required: true,
        options: [
          '1) No mobile',
          '2) At least one mobile',
          '3) Around 25% family members',
          '4) Around 50% family members',
          '5) All family members'
        ]
      },
      {
        id: 'b_3_television',
        sr: '3',
        label: 'Television',
        instruction: 'Ask whether family has TV - Options -',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'b_4_two_wheelers',
        sr: '4',
        label: 'Two wheelers',
        instruction: 'Ask whether family has Motor cycle / Scooter - Options -',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'b_5_four_wheelers',
        sr: '5',
        label: 'Four wheelers (Car, Jeep)',
        instruction: 'Ask whether family has car or jeep or other passenger vehicle - Options -',
        required: true,
        options: ['1) Yes', '2) No']
      }
    ]
  },
  {
    key: 'C',
    code: 'SECTION C',
    title: 'Agricultural Information',
    questions: [
      {
        id: 'c_1_agricultural_land',
        sr: '1',
        label: 'Agricultural land owned by family',
        instruction: 'Ask whether family has agricultural land. Options',
        required: true,
        options: [
          '1) No agricultural land owned by family',
          '2) Up to 5 acres',
          '3) 6-10 Acres',
          '4) 11-30 acres',
          '5) 31-50 Acres',
          '6) More than 50 acres'
        ]
      },
      {
        id: 'c_2_crops',
        sr: '2',
        label: 'Crops',
        instruction: 'Many families have multiple cash crops. If yes then write option which gives maximum money to family. Options are -',
        required: true,
        options: [
          '1) Cotton',
          '2) Sugarcane',
          '3) Soyabean',
          '4) Vegetables / Fruits',
          '5) Onion',
          '6) Jawar / Bajra',
          '7) Wheat',
          '8) Rice',
          '9) Legumes – All types of legumes (Yellow dal, Black dal, Chickpea, etc.)',
          'None / No agricultural land'
        ]
      },
      {
        id: 'c_3_animals_count',
        sr: '3',
        label: 'Number of animals (Bulls + Cows + Buffalos + Goats) owned by family',
        instruction: 'Ask whether family has animals, if no, choose no animals option and if yes, count each type of animal and enter appropriate option Options are - No / Total number of bulls + Cows + Buffalos + Goats',
        required: true,
        options: [
          '1) No animals',
          '2) 1-5 animals',
          '3) 6-10 animals',
          '4) 11-20 animals',
          '5) 21-50 animals',
          '6) 50 + animals'
        ]
      }
    ]
  },
  {
    key: 'D',
    code: 'SECTION D',
    title: 'Food Habits',
    questions: [
      {
        id: 'd_1_dal_frequency',
        sr: '1',
        label: 'Frequency of eating protein rich foods - Dal (Any dal - Yellow, green, black, etc)',
        instruction: 'Dals provide proteins. Ask about frequency of cooking and consuming Dal (Any dal - yellow, green, black, etc.). Options are –',
        required: true,
        options: [
          '1) Daily',
          '2) Frequently (twice a week or more)',
          '3) Once in a week',
          '4) Never'
        ]
      },
      {
        id: 'd_2_green_veg_frequency',
        sr: '2',
        label: 'Frequency of eating Green leafy vegetables (Methi, Palak, etc.)',
        instruction: 'Green leafy vegetables are high in vitamins, minerals and fibre. Ask about frequency of cooking and consuming Green leafy vegetables (Any green leafy vegetable - Methi, Palak, etc.). Options are -',
        required: true,
        options: [
          '1) Daily',
          '2) Frequently (twice a week or more)',
          '3) Once in a week',
          '4) Never'
        ]
      },
      {
        id: 'd_3_fruits_frequency',
        sr: '3',
        label: 'Frequency of eating fruits - Banana, Papaya, Grapes, Apples, any other Fruits',
        instruction: 'Fruits provide vitamins, minerals, fibres and antioxidants. Ask about frequency of eating fruits - Options are -',
        required: true,
        options: [
          '1) Daily',
          '2) Frequently (twice a week or more)',
          '3) Once in a week',
          '4) Never'
        ]
      },
      {
        id: 'd_4_nonveg_frequency',
        sr: '4',
        label: 'Frequency of eating non-vegetarian including egg',
        instruction: 'Non vegetarian food provides complete proteins, vitamins, minerals, etc. Ask whether the family eats eggs and other non-veg foods - Options are -',
        required: true,
        options: [
          '1) Daily',
          '2) Frequently (twice a week or more)',
          '3) Once in a week',
          '4) Never'
        ]
      }
    ]
  },
  {
    key: 'E',
    code: 'SECTION E',
    title: 'Financial Information of Family',
    questions: [
      {
        id: 'e_1_family_business',
        sr: '1',
        label: 'Family Business',
        instruction: 'Ask about family business. If more than one business then write business that gives maximum earnings. Options -',
        required: true,
        options: [
          '1) Agriculture',
          '2) Dairy',
          '3) Poultry',
          '4) Kirana Shop',
          '5) Other shops',
          '6) Hotel',
          '7) Others'
        ]
      },
      {
        id: 'e_2_annual_income',
        sr: '2',
        label: 'Annual income - From all sources',
        instruction: 'There can be various sources of annual income of family, such as agricultural products, salary of employed member of family, sale of milk, animals and poultry, shops, etc. Add income from all sources and enter appropriate option. Options are –',
        required: true,
        options: [
          '1) Less than one lakh',
          '2) 1 - 2.49 Lakh',
          '3) 2.5 - 4.99 Lakh',
          '4) 5 - 9.99 Lakh',
          '5) 10 - 19.99 Lakh',
          '6) 20 Lakh and above'
        ]
      },
      {
        id: 'e_3_expenditure_agriculture',
        sr: '3',
        label: 'Expenditure on Agricultural activities during last year',
        instruction: 'Ask family about expenditure on agricultural activities. This includes expenditure on seeds, fertilisers, equipment on hire, labour charges, diesel, oil and maintenance of tractor and other agricultural equipment, etc. Options are -',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_4_expenditure_health',
        sr: '4',
        label: 'Expenditure on Health - medicines, hospital, delivery, illness, etc during last year',
        instruction: 'Ask family how much they spent last year on medicines and hospitalisation. Options are –',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_5_expenditure_education',
        sr: '5',
        label: 'Expenditure on Education of children during last year',
        instruction: 'Check how many children are in schools, colleges, etc. Add expenditure on fees, books, notebooks, dress, travel to school, hostel, etc. of all children who are studying. Options are –',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_6_expenditure_functions',
        sr: '6',
        label: 'Expenditure on Family, cultural, religious functions during last year',
        instruction: 'Ask whether family had marriage, birthday function, religious function like bhajan, rituals related to death, etc. during last year. Add all these expenses and write appropriate option. Options are -',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_7_expenditure_food',
        sr: '7',
        label: 'Expenditure on Food related items during last year',
        instruction: 'Agricultural families purchase edible oil, spices, salt, etc. Service and business families purchase majority of food items. Ask what food items were purchased from market and how much family spent on food items and write appropriate option. Options are –',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_8_expenditure_vehicles_gadgets',
        sr: '8',
        label: 'Expenditure on TV, Mobile, Vehicles - purchase and running and maintenance cost during one year',
        instruction: 'If family has TV and mobile, record purchase, dish and monthly charges, for vehicles record purchase and petrol/diesel and maintenance and repair charges. Options are –',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_9_other_expenditures',
        sr: '9',
        label: 'Other expenditures during last year',
        instruction: 'Ask family about any other expenditure than discussed. Record if family mentions any other expenditure not mentioned above and write appropriate option. Options are –',
        required: true,
        options: [
          '1) No expenditure',
          '2) Up to Rs. 9999',
          '3) Rs. 10000 to Rs. 24999',
          '4) Rs. 25000 to 49999',
          '5) Rs. 50000 to 99999',
          '6) Rs. 1 Lakh +'
        ]
      },
      {
        id: 'e_10_loan_source',
        sr: '10',
        label: 'If family has taken any loan. If yes, mention the source.',
        instruction: 'Options -',
        required: true,
        options: [
          'No loan taken',
          '1) Nationalised bank',
          '2) Cooperative bank',
          '3) Private Bank',
          '4) Private Money lender',
          '5) Friend',
          '6) Other',
          '7) No information'
        ]
      },
      {
        id: 'e_11_loan_reason',
        sr: '11',
        label: 'Reason for taking loan',
        instruction: 'Options - (Required if loan is taken)',
        required: false,
        conditionalOn: 'e_10_loan_source',
        conditionalValue: (val) => val && val !== 'No loan taken',
        options: [
          'Not applicable (No loan taken)',
          '1) Agricultural expenses',
          '2) Hospital expenses',
          '3) Education expenses',
          '4) Marriage and other family function',
          '5) Death of family member',
          '6) Business',
          '7) Building home',
          '8) Other',
          '9) No specific reason – reason not known'
        ]
      }
    ]
  },
  {
    key: 'F',
    code: 'SECTION F',
    title: 'Ujwala Scheme',
    schemeNote: 'Ujwala scheme : Use of wood, crop residues, coal, kerosine etc. for cooking is important for indoor air pollution which has adverse effect on health. Govt has started Ujwala scheme so that LPG is used for cooking.',
    questions: [
      {
        id: 'f_1_cooking_fuel',
        sr: '1',
        label: 'What fuel you use for cooking',
        instruction: 'Ask family what type of fuel is used for cooking. Family may be using multiple fuels such as wood and LPG for cooking. Enter most often used fuel. Options -',
        required: true,
        options: [
          '1) Cooking gas',
          '2) Cooking gas + Wood',
          '3) Only Wood or charcoal',
          '4) Other'
        ]
      },
      {
        id: 'f_2_gas_connection_source',
        sr: '2',
        label: 'If gas is used for cooking, how did you get the gas connection',
        instruction: 'If option of cooking gas is chosen by family for above question, then ask how the gas connection is purchased. Options -',
        required: false,
        conditionalOn: 'f_1_cooking_fuel',
        conditionalValue: (val) => val && (val.includes('Cooking gas') || val.includes('1)') || val.includes('2)')),
        options: [
          'Not applicable (Cooking gas not used)',
          '1) Through Ujwala scheme',
          '2) Privately purchased',
          '3) Provided by Others'
        ]
      },
      {
        id: 'f_3_ujwala_subsidised',
        sr: '3',
        label: 'If gas is through Ujwala Scheme, do you get free or subsidised cylinder',
        instruction: 'The family should get gas cylinder free or at subsidised rates if the connection is under Ujwala scheme. Options –',
        required: false,
        conditionalOn: 'f_2_gas_connection_source',
        conditionalValue: (val) => val && (val.includes('Ujwala scheme') || val.includes('1)')),
        options: [
          'Not applicable',
          '1) Get free cylinder',
          '2) Get subsidised cylinder',
          '3) Do not get free or subsidised'
        ]
      }
    ]
  },
  {
    key: 'G',
    code: 'SECTION G',
    title: 'Soil Health Card Scheme',
    schemeNote: 'Soil health card scheme : This scheme aims at promoting soil test-based use of fertilizers to get high yield at lower cost. Soil Health Card is issued to individual farms. Soil is tested in laboratory by applying 12 parameters and card is issued to farmers.',
    questions: [
      {
        id: 'g_1_soil_card_prepared',
        sr: '1',
        label: 'Whether soil card is prepared for all the farms owned by family',
        instruction: 'Options -',
        required: true,
        options: [
          '1) Not applicable as no farm',
          '2) Soil card prepared for all farms',
          '3) Soil card prepared for few farms',
          '4) No soil card prepared.'
        ]
      },
      {
        id: 'g_2_soil_card_usage',
        sr: '2',
        label: 'If soil card is prepared, how do you use information',
        instruction: 'Options -',
        required: false,
        conditionalOn: 'g_1_soil_card_prepared',
        conditionalValue: (val) => val && (val.includes('all farms') || val.includes('few farms') || val.includes('2)') || val.includes('3)')),
        options: [
          '1) Not applicable as no card',
          '2) Not using the information',
          '3) Changing fertiliser pattern',
          '4) Changing crop pattern',
          '5) Considered for improving soil quality'
        ]
      }
    ]
  },
  {
    key: 'H',
    code: 'SECTION H',
    title: 'Janani Shishu Suraksha Karyakram',
    schemeNote: 'Janani Shishu Suraksha Karyakram (JSSK) : Under this scheme, all the pregnant women are offered free of cost check-up, free sonography during pregnancy, free transport from home to hospital for delivery and hospital to home after delivery, free diet and medicine during delivery.',
    questions: [
      {
        id: 'h_1_pregnant_last_year',
        sr: '1',
        label: 'Was any lady in family pregnant and delivered during last one year',
        instruction: 'Options -',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'h_2_delivery_place',
        sr: '2',
        label: 'If yes, where delivery took place',
        instruction: 'Options -',
        required: false,
        conditionalOn: 'h_1_pregnant_last_year',
        conditionalValue: (val) => val && (val.includes('Yes') || val.includes('1)')),
        options: [
          'Not applicable',
          '1) In Government Hospital',
          '2) In Private Hospital',
          '3) At Home',
          '4) During transportation'
        ]
      },
      {
        id: 'h_3_delivery_expenditure',
        sr: '3',
        label: 'What was total expenditure for delivery including travel, food, hospital stay, investigations, treatment, blood, medicine, etc.',
        instruction: 'Options –',
        required: false,
        conditionalOn: 'h_1_pregnant_last_year',
        conditionalValue: (val) => val && (val.includes('Yes') || val.includes('1)')),
        options: [
          'Not applicable',
          'No expenditure',
          'Up to Rs. 4999',
          'Rs. 5000 to Rs. 9999',
          'Rs. 10000 to Rs. 49999',
          'Rs. 50000 to Rs. 1.0 Lakh',
          'More than Rs. 1 Lakh'
        ]
      },
      {
        id: 'h_4_delivery_money_source',
        sr: '4',
        label: 'How did you raise money for delivery',
        instruction: 'Options -',
        required: false,
        conditionalOn: 'h_1_pregnant_last_year',
        conditionalValue: (val) => val && (val.includes('Yes') || val.includes('1)')),
        options: [
          'Not applicable (No expenditure / Not delivered)',
          '1) Family savings',
          '2) Borrowed from friends and relatives',
          '3) Loan from pvt money lender'
        ]
      }
    ]
  },
  {
    key: 'I',
    code: 'SECTION I',
    title: 'Mahatma Jyotirao Phule Jan Arogya (MJPJAY)',
    schemeNote: 'Mahatma Jyotirao Phule Jan Arogya (MJPJAY) : Under this scheme, if anybody is suffering from diseases like heart diseases, stroke, cancer, etc. can get free treatment in govt or private hospitals. Cost of treatment is borne by government under MJPJAY scheme.',
    questions: [
      {
        id: 'i_1_suffering_serious_illness',
        sr: '1',
        label: 'Is anybody in house suffering or suffered from cancer, stroke, heart disease, accident/fracture in last one year',
        instruction: 'Options -',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'i_2_free_treatment_mjpjay',
        sr: '2',
        label: 'Did you get free treatment under Mahatma Jyotirao Phule Jan Arogya yojana for this patient',
        instruction: 'Options - 1) Yes 2) No 3) Do not know (If yes skip next 2 questions)',
        required: false,
        conditionalOn: 'i_1_suffering_serious_illness',
        conditionalValue: (val) => val && (val.includes('Yes') || val.includes('1)')),
        options: ['Not applicable', '1) Yes', '2) No', '3) Do not know']
      },
      {
        id: 'i_3_reason_no_free_treatment',
        sr: '3',
        label: 'If no, what was the reason for not getting free treatment under MJPJAY',
        instruction: 'Options - (Skipped if patient received free treatment)',
        required: false,
        conditionalOn: 'i_2_free_treatment_mjpjay',
        conditionalValue: (val) => val && (val.includes('No') || val.includes('Do not know') || val.includes('2)') || val.includes('3)')),
        options: [
          'Not applicable',
          '1) Did not know the scheme',
          '2) Hospital said not applicable to patient',
          '3) Could not submit documents',
          '4) Patient included in scheme but additional amount required to be paid',
          '5) Not eligible for scheme'
        ]
      },
      {
        id: 'i_4_patient_expenditure',
        sr: '4',
        label: 'If no, how much was expenditure in last one year for this patient',
        instruction: 'Options are – (Skipped if patient received free treatment)',
        required: false,
        conditionalOn: 'i_2_free_treatment_mjpjay',
        conditionalValue: (val) => val && (val.includes('No') || val.includes('Do not know') || val.includes('2)') || val.includes('3)')),
        options: [
          'Not applicable',
          '1) Up to Rs. 24999',
          '2) Rs. 25000 to 49999',
          '3) Rs. 50000 to 99999',
          '4) Rs. 1 Lakh to Rs. 1.99 Lakh',
          '5) Rs. 2.0 Lakh to 4.99 Lakh',
          '6) Rs. 5.0 Lakh +'
        ]
      }
    ]
  },
  {
    key: 'J',
    code: 'SECTION J',
    title: 'Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY)',
    schemeNote: 'Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY) : Central Govt has launched the Scheme of providing free food grains to families - 35 kg/month to Antyoday Anna Yojana (AAY) households and 5 kg/person per month to Priority Household (PHH). Scheme will continue till 2029.',
    questions: [
      {
        id: 'j_1_ration_card_type',
        sr: '1',
        label: 'What type of ration card you have',
        instruction: 'Ask family which colour ration card family has and write appropriate option. Options',
        required: true,
        options: [
          '1) White ration card',
          '2) Yellow ration card',
          '3) Saffron ration card',
          '4) No ration card'
        ]
      },
      {
        id: 'j_2_grains_quantity',
        sr: '2',
        label: 'If yellow ration card, how much food grains you get from ration shop',
        instruction: 'Options',
        required: false,
        conditionalOn: 'j_1_ration_card_type',
        conditionalValue: (val) => val && (val.includes('Yellow') || val.includes('2)')),
        options: [
          '1) No yellow ration card so not applicable',
          '2) 5 Kg ration per month',
          '3) 35 Kg ration per month',
          '4) Do not get anything'
        ]
      }
    ]
  },
  {
    key: 'K',
    code: 'SECTION K',
    title: 'Jal Jeevan Mission (JJM) (Har Ghar Jal)',
    schemeNote: 'Jal Jeevan Mission (JJM) (Har Ghar Jal) : Jal Jeevan Mission is envisaged to provide safe and adequate drinking water through individual household tap connections. All households are expected to be covered by 2024.',
    questions: [
      {
        id: 'k_1_water_source',
        sr: '1',
        label: 'From where you collect water for drinking and cooking',
        instruction: 'Ask family from where they collect water for drinking. If multiple sources then select option major source Options -',
        required: true,
        options: [
          '1) Water tap within house',
          '2) Public Water tap',
          '3) Hand pump',
          '4) Well',
          '5) Other'
        ]
      },
      {
        id: 'k_2_tap_installation',
        sr: '2',
        label: 'If separate tap is provided in your house, how it is installed?',
        instruction: 'Options',
        required: false,
        conditionalOn: 'k_1_water_source',
        conditionalValue: (val) => val && (val.includes('Water tap within house') || val.includes('1)')),
        options: [
          'Not applicable (No tap in house)',
          '1) From Family funds',
          '2) From Jal Jeevan Mission',
          '3) From Gram Panchayat',
          '4) Do not know'
        ]
      }
    ]
  },
  {
    key: 'L',
    code: 'SECTION L',
    title: 'Swachha Bharat Mission (SBM)',
    schemeNote: 'Swachha Bharat Mission (SBM) : Swachha Bharat Mission provides toilets to individual households to become open defecation free (ODF) and also helps gram panchayat in solid and liquid waste management.',
    questions: [
      {
        id: 'l_1_toilet_available',
        sr: '1',
        label: 'Do you have toilet in your house',
        instruction: 'Ask the family about availability of toilet for individual family. Options 1) Yes 2) No (If no, enter not applicable option of next question)',
        required: true,
        options: ['1) Yes', '2) No']
      },
      {
        id: 'l_2_toilet_usage',
        sr: '2',
        label: 'If yes, who uses the toilet',
        instruction: 'Options',
        required: false,
        conditionalOn: 'l_1_toilet_available',
        conditionalValue: (val) => val && (val.includes('Yes') || val.includes('1)')),
        options: [
          '1) Not applicable as no toilet',
          '2) All family members use the toilet',
          '3) Only ladies use the toilet',
          '4) No specific pattern',
          '5) Nobody uses the toilet'
        ]
      }
    ]
  },
  {
    key: 'M',
    code: 'SECTION M',
    title: 'Mukhyamantri Mazi Ladaki Bahin Yojana (MMLBY)',
    schemeNote: 'Mukhyamantri Mazi Ladaki Bahin Yojana (MMLBY) : Govt of Maharashtra has started this new scheme for all women of age group 21 to 65 years having annual family income less than 2.5 Lakh. Beneficiary will get Rs. 1500 PM in her bank account connected to her Adhaar card.',
    questions: [
      {
        id: 'm_1_ladki_bahin_status',
        sr: '1',
        label: 'Do the ladies above 21 years get Rs. 1500/- under Mukhyamantri Mazi Ladki Bahin Yojna',
        instruction: 'Options',
        required: true,
        options: [
          '1) All ladies above 21 years get Rs. 1500/- PM',
          '2) Few ladies above 21 years get Rs. 1500/- PM',
          '3) Family not eligible as income is above 2.5 Lakh so do not get',
          '4) Family eligible still do not get'
        ]
      },
      {
        id: 'm_2_money_usage',
        sr: '2',
        label: 'If yes, how do you use the money received from this scheme',
        instruction: 'Options',
        required: false,
        conditionalOn: 'm_1_ladki_bahin_status',
        conditionalValue: (val) => val && (val.includes('All ladies') || val.includes('Few ladies') || val.includes('1)') || val.includes('2)')),
        options: [
          '1) Do not get money so not applicable',
          '2) On education of children',
          '3) To cover hospital expenses / medicines',
          '4) For purchase of items for family',
          '5) For purchase of items for personal use',
          '6) Family function, ceremony',
          '7) Daily expenditure',
          '8) Other',
          '9) Not spent – available in bank account'
        ]
      }
    ]
  },
  {
    key: 'OBSERVATIONS',
    code: 'ADDITIONAL NOTES',
    title: 'Field Observations & Hardships',
    subtitle: 'Student notes on community hardships and family feedback',
    questions: [
      {
        id: 'family_specific_problems',
        sr: 'N1',
        label: 'Key Problems / Hardships Expressed by Family',
        type: 'textarea',
        placeholder: 'Water scarcity, debt, disease burden, unemployment, crop loss, school transport...',
        instruction: 'Record specific problems, grievances or struggles observed or reported by family members',
        required: false
      },
      {
        id: 'respondent_suggestions',
        sr: 'N2',
        label: "Respondent's Suggestions for Village Improvement",
        type: 'textarea',
        placeholder: 'What major priority intervention would improve this family’s well-being...',
        instruction: 'Record constructive suggestions offered by the household head or family members',
        required: false
      }
    ]
  }
];

/**
 * Creates default data template for a new family record.
 */
export function createNewFamilyTemplate(serialNum = 1, defaultVillageName = '', defaultRiVillageId = null) {
  return {
    family_serial_number: serialNum,
    family_number: serialNum,
    village_name: defaultVillageName || '',
    ri_village_id: defaultRiVillageId || null,
    head_of_family_name: '',
    total_family_members: '',
    male_members: '',
    female_members: '',
    respondent_name: '',
    contact_number: '',

    // Section A
    a_1_type_of_house: '',
    a_2_ownership_of_house: '',

    // Section B
    b_1_electricity: '',
    b_2_mobile_phones: '',
    b_3_television: '',
    b_4_two_wheelers: '',
    b_5_four_wheelers: '',

    // Section C
    c_1_agricultural_land: '',
    c_2_crops: '',
    c_3_animals_count: '',

    // Section D
    d_1_dal_frequency: '',
    d_2_green_veg_frequency: '',
    d_3_fruits_frequency: '',
    d_4_nonveg_frequency: '',

    // Section E
    e_1_family_business: '',
    e_2_annual_income: '',
    e_3_expenditure_agriculture: '',
    e_4_expenditure_health: '',
    e_5_expenditure_education: '',
    e_6_expenditure_functions: '',
    e_7_expenditure_food: '',
    e_8_expenditure_vehicles_gadgets: '',
    e_9_other_expenditures: '',
    e_10_loan_source: '',
    e_11_loan_reason: '',

    // Section F
    f_1_cooking_fuel: '',
    f_2_gas_connection_source: '',
    f_3_ujwala_subsidised: '',

    // Section G
    g_1_soil_card_prepared: '',
    g_2_soil_card_usage: '',

    // Section H
    h_1_pregnant_last_year: '',
    h_2_delivery_place: '',
    h_3_delivery_expenditure: '',
    h_4_delivery_money_source: '',

    // Section I
    i_1_suffering_serious_illness: '',
    i_2_free_treatment_mjpjay: '',
    i_3_reason_no_free_treatment: '',
    i_4_patient_expenditure: '',

    // Section J
    j_1_ration_card_type: '',
    j_2_grains_quantity: '',

    // Section K
    k_1_water_source: '',
    k_2_tap_installation: '',

    // Section L
    l_1_toilet_available: '',
    l_2_toilet_usage: '',

    // Section M
    m_1_ladki_bahin_status: '',
    m_2_money_usage: '',

    // Additional Notes
    family_specific_problems: '',
    respondent_suggestions: '',

    survey_data: {}
  };
}

/**
 * Gets value of a field from either survey_data or legacy column.
 */
export function getFamilyFieldValue(fam, fieldId) {
  if (!fam) return '';
  const sd = fam.survey_data && typeof fam.survey_data === 'object' ? fam.survey_data : {};
  if (sd[fieldId] !== undefined && sd[fieldId] !== null) return sd[fieldId];
  if (fam[fieldId] !== undefined && fam[fieldId] !== null) return fam[fieldId];

  // Records saved with survey_data carry the student's real answers there. The legacy columns of such
  // records contain server-side placeholder defaults (e.g. house_type 'Pakka'), which must NOT be shown
  // as if the student had answered. Only legacy records (no survey_data) use the fallback below.
  if (Object.keys(sd).length > 0) return '';

  // Legacy mappings fallback

  switch (fieldId) {
    case 'a_1_type_of_house':
      return fam.house_type || '';
    case 'a_2_ownership_of_house':
      return fam.house_ownership || '';
    case 'b_1_electricity':
      return fam.electricity_available !== undefined ? (fam.electricity_available ? '1) Yes' : '2) No') : '';
    case 'b_2_mobile_phones':
      return fam.mobile_phones_level || '';
    case 'b_3_television':
      return fam.television_available !== undefined ? (fam.television_available ? '1) Yes' : '2) No') : '';
    case 'b_4_two_wheelers':
      return fam.two_wheeler_available !== undefined ? (fam.two_wheeler_available ? '1) Yes' : '2) No') : '';
    case 'b_5_four_wheelers':
      return fam.four_wheeler_available !== undefined ? (fam.four_wheeler_available ? '1) Yes' : '2) No') : '';
    case 'c_1_agricultural_land':
      return fam.agricultural_land || '';
    case 'c_2_crops':
      return fam.primary_crop || '';
    case 'c_3_animals_count':
      return fam.animals_count_bracket || '';
    case 'd_1_dal_frequency':
      return fam.diet_dal_frequency || '';
    case 'd_2_green_veg_frequency':
      return fam.diet_green_veg_frequency || '';
    case 'd_3_fruits_frequency':
      return fam.diet_fruits_frequency || '';
    case 'd_4_nonveg_frequency':
      return fam.diet_nonveg_egg_frequency || '';
    case 'e_1_family_business':
      return fam.primary_business_occupation || fam.primary_occupation || '';
    case 'e_2_annual_income':
      return fam.monthly_income_range || '';
    case 'e_4_expenditure_health':
      return fam.expenditure_health_hospital || '';
    case 'e_5_expenditure_education':
      return fam.expenditure_education || '';
    case 'e_6_expenditure_functions':
      return fam.expenditure_functions || '';
    case 'e_7_expenditure_food':
      return fam.expenditure_food || '';
    case 'e_8_expenditure_vehicles_gadgets':
      return fam.expenditure_vehicles_gadgets || '';
    case 'e_9_other_expenditures':
      return fam.expenditure_other || '';
    case 'e_10_loan_source':
      return fam.loan_source || (fam.loan_taken ? 'Yes' : 'No loan taken');
    case 'e_11_loan_reason':
      return fam.loan_reason || '';
    case 'f_1_cooking_fuel':
      return fam.cooking_fuel || '';
    case 'f_2_gas_connection_source':
      return fam.gas_connection_source || '';
    case 'f_3_ujwala_subsidised':
      return fam.ujwala_subsidised || '';
    case 'g_1_soil_card_prepared':
      return fam.soil_health_card_status || '';
    case 'g_2_soil_card_usage':
      return fam.soil_health_card_usage || '';
    case 'h_1_pregnant_last_year':
      return fam.jssk_pregnant_last_year !== undefined ? (fam.jssk_pregnant_last_year ? '1) Yes' : '2) No') : '';
    case 'h_2_delivery_place':
      return fam.jssk_delivery_place || '';
    case 'k_1_water_source':
      return fam.drinking_water_source || '';
    case 'l_1_toilet_available':
      return fam.toilet_facility ? (fam.toilet_facility.toLowerCase().includes('individual') ? '1) Yes' : '2) No') : '';
    case 'family_specific_problems':
      return fam.key_problems_identified || fam.family_specific_problems || '';
    case 'village_name':
      return fam.village_name || sd.village_name || '';
    case 'respondent_suggestions':
      return fam.respondent_suggestions || '';
    default:
      return '';
  }
}

/**
 * Sets value of a field in both record top-level (for standard cols) and survey_data.
 */
export function setFamilyFieldValue(fam, fieldId, value) {
  if (!fam) return fam;
  const currentSd = fam.survey_data && typeof fam.survey_data === 'object' ? fam.survey_data : {};
  const updatedSd = { ...currentSd, [fieldId]: value };

  const updatedFam = {
    ...fam,
    [fieldId]: value,
    survey_data: updatedSd
  };

  if (fieldId === 'village_name') updatedFam.village_name = value;
  if (fieldId === 'ri_village_id') updatedFam.ri_village_id = value;
  if (fieldId === 'head_of_family_name') updatedFam.head_of_family_name = value;
  if (fieldId === 'total_family_members') updatedFam.total_family_members = value;
  if (fieldId === 'male_members') updatedFam.male_members = value;
  if (fieldId === 'female_members') updatedFam.female_members = value;
  if (fieldId === 'family_specific_problems') updatedFam.family_specific_problems = value;

  return updatedFam;
}

/**
 * Validates a single family record.
 */
export function validateFamilyRecord(rec) {
  if (!rec) return 'No family survey data provided.';
  const vName = (rec.village_name || rec.survey_data?.village_name || '').trim();
  if (!vName) return 'Please select or enter Village Name.';
  if (!rec.head_of_family_name?.trim() || rec.head_of_family_name.trim().startsWith('Draft Family #')) {
    return 'Please enter Head of Family Name.';
  }
  if (!rec.total_family_members || parseInt(rec.total_family_members, 10) < 1) {
    return 'Please enter Total Family Members (at least 1).';
  }
  if (!rec.respondent_name?.trim() && !rec.survey_data?.respondent_name?.trim()) {
    return 'Please enter Respondent Name.';
  }
  return null;
}
