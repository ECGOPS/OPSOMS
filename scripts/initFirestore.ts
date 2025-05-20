import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data for each collection
const sampleData = {
  'regions': [
    { id: 'region1', name: 'SUBTRANSMISSION ACCRA', code: 'STA', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region2', name: 'SUBTRANSMISSION ASHANTI', code: 'STAS', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region3', name: 'ACCRA EAST REGION', code: 'AER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region4', name: 'ACCRA WEST REGION', code: 'AWR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region5', name: 'ASHANTI EAST REGION', code: 'ASER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region6', name: 'ASHANTI WEST REGION', code: 'ASWR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region7', name: 'ASHANTI SOUTH REGION', code: 'ASSR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region8', name: 'CENTRAL REGION', code: 'CR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region9', name: 'EASTERN REGION', code: 'ER', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region10', name: 'TEMA REGION', code: 'TR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region11', name: 'VOLTA REGION', code: 'VR', createdAt: new Date(), updatedAt: new Date() },
    { id: 'region12', name: 'WESTERN REGION', code: 'WR', createdAt: new Date(), updatedAt: new Date() }
  ],
  'districts': [
    // SUBTRANSMISSION ACCRA
    { id: 'district1', name: 'SUBSTATION MAINTENANCE', code: 'STASM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district2', name: 'CONTROL OPERATIONS', code: 'STACO', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district3', name: 'NETWORK MAINTENANCE', code: 'STANM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district4', name: 'PROTECTION MAINTENANCE', code: 'STAPM', regionId: 'region1', createdAt: new Date(), updatedAt: new Date() },

    // SUBTRANSMISSION ASHANTI
    { id: 'district5', name: 'SUBSTATION MAINTENANCE', code: 'STSSM', regionId: 'region2', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district6', name: 'CONTROL OPERATIONS', code: 'STSCO', regionId: 'region2', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district7', name: 'NETWORK MAINTENANCE', code: 'STSNM', regionId: 'region2', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district8', name: 'PROTECTION MAINTENANCE', code: 'STSPM', regionId: 'region2', createdAt: new Date(), updatedAt: new Date() },

    // ACCRA EAST REGION
    { id: 'district9', name: 'ADENTA', code: 'ADA', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district10', name: 'DODOWA', code: 'DOD', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district11', name: 'KWABENYA', code: 'KWA', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district12', name: 'LEGON', code: 'LEG', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district13', name: 'MAKOLA', code: 'MAK', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district14', name: 'AKWAPIM MAMPONG', code: 'AKM', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district15', name: 'ROMAN RIDGE', code: 'ROR', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district16', name: 'TESHIE', code: 'TES', regionId: 'region3', createdAt: new Date(), updatedAt: new Date() },

    // ACCRA WEST REGION
    { id: 'district17', name: 'ABLEKUMA', code: 'ABL', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district18', name: 'ACHIMOTA', code: 'ACH', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district19', name: 'AMASAMAN', code: 'AMA', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district20', name: 'BORTIANOR', code: 'BOR', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district21', name: 'DANSOMAN', code: 'DAN', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district22', name: 'KANESHIE', code: 'KAN', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district23', name: 'KORLE-BU', code: 'KOR', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district24', name: 'NSAWAM', code: 'NSW', regionId: 'region4', createdAt: new Date(), updatedAt: new Date() },

    // ASHANTI EAST REGION
    { id: 'district25', name: 'AYIGYA', code: 'AYI', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district26', name: 'EFFIDUASE', code: 'EFF', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district27', name: 'EJISU', code: 'EJI', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district28', name: 'KONONGO', code: 'KON', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district29', name: 'KWABRE', code: 'KWB', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district30', name: 'MAMPONG', code: 'MMP', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district31', name: 'MANHYIA', code: 'MNH', regionId: 'region5', createdAt: new Date(), updatedAt: new Date() },

    // ASHANTI WEST REGION
    { id: 'district32', name: 'ABUAKWA', code: 'ABK', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district33', name: 'ADUM', code: 'ADM', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district34', name: 'AHINSAN', code: 'AHN', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district35', name: 'BIBIANI', code: 'BIB', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district36', name: 'DANYAME', code: 'DNY', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district37', name: 'KOKOBEN', code: 'KKB', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district38', name: 'SUAME', code: 'SUA', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district39', name: 'OFFINSO', code: 'OFF', regionId: 'region6', createdAt: new Date(), updatedAt: new Date() },

    // ASHANTI SOUTH REGION
    { id: 'district40', name: 'ASOKWA', code: 'ASK', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district41', name: 'BEKWAI', code: 'BEK', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district42', name: 'DUNKWA', code: 'DUN', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district43', name: 'MANSO NKWANTA', code: 'MNK', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district44', name: 'NEW EDUBIASE', code: 'NED', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district45', name: 'OBUASI', code: 'OBU', regionId: 'region7', createdAt: new Date(), updatedAt: new Date() },

    // CENTRAL REGION
    { id: 'district46', name: 'AGONA SWEDRU', code: 'AGS', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district47', name: 'AJUMAKO', code: 'AJU', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district48', name: 'ASSIN FOSO', code: 'ASF', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district49', name: 'BREMAN ASIKUMA', code: 'BAS', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district50', name: 'CAPE COAST', code: 'CPC', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district51', name: 'KASOA NORTH', code: 'KSN', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district52', name: 'KASOA SOUTH', code: 'KSS', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district53', name: 'SALTPOND', code: 'SLT', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district54', name: 'TWIFU PRASO', code: 'TWP', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district55', name: 'WINNEBA', code: 'WIN', regionId: 'region8', createdAt: new Date(), updatedAt: new Date() },

    // EASTERN REGION
    { id: 'district56', name: 'AKIM ODA', code: 'AKO', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district57', name: 'AKIM TAFO', code: 'AKT', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district58', name: 'AKWATIA', code: 'AKW', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district59', name: 'ASAMANKESE', code: 'ASM', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district60', name: 'BEGORO', code: 'BEG', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district61', name: 'DONKORKROM', code: 'DON', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district62', name: 'KADE', code: 'KAD', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district63', name: 'KIBI', code: 'KIB', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district64', name: 'KOFORIDUA', code: 'KOF', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district65', name: 'MPRAESO', code: 'MPR', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district66', name: 'NEW ABIREM', code: 'NAB', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district67', name: 'NKAWKAW', code: 'NKW', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district68', name: 'SUHUM', code: 'SUH', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district69', name: 'ASESEWA', code: 'ASW', regionId: 'region9', createdAt: new Date(), updatedAt: new Date() },

    // TEMA REGION
    { id: 'district70', name: 'ADA', code: 'ADA', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district71', name: 'AFIENYA', code: 'AFY', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district72', name: 'ASHAIMAN', code: 'ASH', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district73', name: 'JUAPONG', code: 'JUA', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district74', name: 'KROBO', code: 'KRB', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district75', name: 'NUNGUA', code: 'NUN', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district76', name: 'PRAMPRAM', code: 'PRM', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district77', name: 'TEMA NORTH', code: 'TMN', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district78', name: 'TEMA SOUTH', code: 'TMS', regionId: 'region10', createdAt: new Date(), updatedAt: new Date() },

    // VOLTA REGION
    { id: 'district79', name: 'AKATSI', code: 'AKT', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district80', name: 'DAMBAI', code: 'DAM', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district81', name: 'DENU', code: 'DEN', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district82', name: 'HO', code: 'HO', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district83', name: 'HOHOE', code: 'HOH', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district84', name: 'JASIKAN', code: 'JAS', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district85', name: 'KETA', code: 'KET', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district86', name: 'KPANDU', code: 'KPD', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district87', name: 'KPEVE', code: 'KPV', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district88', name: 'NKWANTA', code: 'NKW', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district89', name: 'SOGAKOPE', code: 'SOG', regionId: 'region11', createdAt: new Date(), updatedAt: new Date() },

    // WESTERN REGION
    { id: 'district90', name: 'AGONA', code: 'AGN', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district91', name: 'ASANKRAGUA', code: 'ASK', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district92', name: 'AXIM', code: 'AXM', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district93', name: 'BOGOSO', code: 'BOG', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district94', name: 'ENCHI', code: 'ENC', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district95', name: 'HALF ASSINI', code: 'HAS', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district96', name: 'SEFWI WIAWSO', code: 'SWW', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district97', name: 'JUABESO', code: 'JUA', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district98', name: 'SEKONDI', code: 'SEK', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district99', name: 'TAKORADI', code: 'TAK', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() },
    { id: 'district100', name: 'TARKWA', code: 'TAR', regionId: 'region12', createdAt: new Date(), updatedAt: new Date() }
  ],
  'op5-faults': [
    {
      id: 'fault1',
      regionId: 'region1',
      districtId: 'district1',
      occurrenceDate: new Date().toISOString(),
      restorationDate: null,
      repairDate: null,
      status: 'active',
      faultType: 'Unplanned',
      specificFaultType: 'JUMPER CUT',
      faultLocation: 'Sample Location',
      outageDescription: 'Sample outage description',
      affectedPopulation: {
        rural: 100,
        urban: 200,
        metro: 300
      },
      mttr: 2.5,
      reliabilityIndices: {
        saidi: 1.5,
        saifi: 0.8,
        caidi: 1.8
      },
      materialsUsed: [
        {
          id: 'mat1',
          type: 'Fuse',
          rating: '100A',
          quantity: 2
        }
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'user1'
    }
  ],
  'control-outages': [
    {
      id: 'outage1',
      regionId: 'region1',
      districtId: 'district1',
      occurrenceDate: new Date().toISOString(),
      restorationDate: new Date().toISOString(),
      faultType: 'Planned',
      specificFaultType: 'PLANNED MAINTENANCE',
      status: 'resolved',
      reason: 'Scheduled maintenance',
      controlPanelIndications: 'Normal',
      areaAffected: 'Sample Area',
      loadMW: 50.5,
      unservedEnergyMWh: 25.3,
      customersAffected: {
        rural: 100,
        urban: 200,
        metro: 300
      },
      createdBy: 'user1',
      createdAt: new Date().toISOString()
    }
  ],
  'vit-assets': [
    {
      id: 'asset1',
      regionId: 'region1',
      districtId: 'district1',
      voltageLevel: '11KV',
      typeOfUnit: 'Ring Main Unit',
      serialNumber: 'RMU2023-001',
      location: 'Main Street Substation',
      gpsCoordinates: '5.6037, -0.1870',
      status: 'Operational',
      protection: 'Overcurrent, Earth Fault',
      photoUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user1'
    }
  ],
  'vit-inspections': [
    {
      id: 'inspection1',
      vitAssetId: 'asset1',
      region: 'SUBTRANSMISSION ACCRA',
      district: 'SUBSTATION MAINTENANCE',
      inspectionDate: new Date().toISOString(),
      inspectedBy: 'technician1',
      rodentTermiteEncroachment: 'No',
      cleanDustFree: 'Yes',
      protectionButtonEnabled: 'Yes',
      recloserButtonEnabled: 'Yes',
      groundEarthButtonEnabled: 'Yes',
      acPowerOn: 'Yes',
      batteryPowerLow: 'No',
      handleLockOn: 'Yes',
      remoteButtonEnabled: 'Yes',
      gasLevelLow: 'No',
      earthingArrangementAdequate: 'Yes',
      noFusesBlown: 'Yes',
      noDamageToBushings: 'Yes',
      noDamageToHVConnections: 'Yes',
      insulatorsClean: 'Yes',
      paintworkAdequate: 'Yes',
      ptFuseLinkIntact: 'Yes',
      noCorrosion: 'Yes',
      silicaGelCondition: 'Good',
      correctLabelling: 'Yes',
      remarks: 'All systems normal',
      createdBy: 'user1',
      createdAt: new Date().toISOString()
    }
  ],
  'substation-inspections': [
    {
      id: 'subinspection1',
      region: 'SUBTRANSMISSION ACCRA',
      district: 'SUBSTATION MAINTENANCE',
      date: new Date().toISOString(),
      substationNo: 'SUB001',
      substationName: 'Main Street Substation',
      type: 'outdoor',
      inspectionDate: new Date().toISOString(),
      inspectedBy: 'technician1',
      location: 'Main Street',
      voltageLevel: '11KV',
      status: 'Completed',
      generalBuilding: [],
      controlEquipment: [],
      powerTransformer: [],
      outdoorEquipment: [],
      createdAt: new Date().toISOString(),
      createdBy: 'user1'
    }
  ],
  'load-monitoring': [
    {
      id: 'load1',
      substationId: 'SUB001',
      date: new Date().toISOString(),
      peakLoad: 85.5,
      offPeakLoad: 45.2,
      voltage: 11000,
      current: 100,
      powerFactor: 0.92,
      recordedBy: 'technician1',
      notes: 'Normal operation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  'overheadLineInspections': [
    {
      id: 'ohli1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      date: new Date().toISOString(),
      time: new Date().toISOString(),
      regionId: 'region1',
      districtId: 'district1',
      feederName: 'Main Feeder',
      voltageLevel: '11KV',
      referencePole: 'P001',
      latitude: 5.6037,
      longitude: -0.1870,
      status: 'completed',
      inspector: {
        id: 'inspector1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890'
      },
      poleId: 'P001',
      poleHeight: '11m',
      poleType: 'CP',
      poleLocation: 'Main Street',
      poleCondition: {
        tilted: false,
        rotten: false,
        burnt: false,
        substandard: false,
        conflictWithLV: false,
        notes: 'Good condition'
      },
      stayCondition: {
        requiredButNotAvailable: false,
        cut: false,
        misaligned: false,
        defectiveStay: false,
        notes: 'Good condition'
      },
      crossArmCondition: {
        misaligned: false,
        bend: false,
        corroded: false,
        substandard: false,
        others: false,
        notes: 'Good condition'
      },
      insulatorCondition: {
        brokenOrCracked: false,
        burntOrFlashOver: false,
        shattered: false,
        defectiveBinding: false,
        notes: 'Good condition'
      },
      conductorCondition: {
        looseConnectors: false,
        weakJumpers: false,
        burntLugs: false,
        saggedLine: false,
        undersized: false,
        linked: false,
        notes: 'Good condition'
      },
      lightningArresterCondition: {
        brokenOrCracked: false,
        flashOver: false,
        missing: false,
        noEarthing: false,
        bypassed: false,
        noArrester: false,
        notes: 'Good condition'
      },
      dropOutFuseCondition: {
        brokenOrCracked: false,
        flashOver: false,
        insufficientClearance: false,
        looseOrNoEarthing: false,
        corroded: false,
        linkedHVFuses: false,
        others: false,
        notes: 'Good condition'
      },
      transformerCondition: {
        leakingOil: false,
        missingEarthLeads: false,
        linkedHVFuses: false,
        rustedTank: false,
        crackedBushing: false,
        others: false,
        notes: 'Good condition'
      },
      recloserCondition: {
        lowGasLevel: false,
        lowBatteryLevel: false,
        burntVoltageTransformers: false,
        protectionDisabled: false,
        bypassed: false,
        others: false,
        notes: 'Good condition'
      },
      additionalNotes: 'All systems normal',
      images: []
    }
  ],
  'users': [
    {
      id: 'user1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'system_admin',
      region: null,
      district: null,
      staffId: 'ADM001',
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'user2',
      name: 'District Engineer',
      email: 'engineer@example.com',
      role: 'district_engineer',
      region: 'SUBTRANSMISSION ACCRA',
      district: 'SUBSTATION MAINTENANCE',
      staffId: 'ENG001',
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

async function clearCollection(collectionName: string) {
  const querySnapshot = await getDocs(collection(db, collectionName));
  const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  console.log(`Cleared collection: ${collectionName}`);
}

async function initializeCollection(
  collectionName: string,
  items: Array<Record<string, any>>
) {
  const collectionRef = collection(db, collectionName);
  
  // Clear existing documents
  const snapshot = await getDocs(collectionRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  // Add new documents
  for (const item of items) {
    const docRef = doc(collectionRef, item.id);
    // Convert Date objects to ISO strings, but keep existing string dates as is
    const data = Object.entries(item).reduce((acc, [key, value]) => {
      if (value && typeof value === 'object' && 'toISOString' in value) {
        acc[key] = (value as Date).toISOString();
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    await setDoc(docRef, data);
  }
  console.log(`Initialized collection: ${collectionName}`);
}

async function initializeFirestore() {
  try {
    for (const [collectionName, data] of Object.entries(sampleData)) {
      await initializeCollection(collectionName, data);
    }
    console.log('Firestore initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing Firestore:', error);
  }
}

// Run the initialization
initializeFirestore(); 