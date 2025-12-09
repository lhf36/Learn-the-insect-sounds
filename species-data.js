/*
  species-data.js

  This file holds all species used in the Insect Song Learning Game.

  To ADD a new insect, copy the TEMPLATE object at the bottom of this file
  into the SONGS_DATA array (above the closing ]), then edit:

    - commonName       : short English name
    - species          : scientific name (Genus species)
    - spectrogramImage : path to spectrogram image (or main visual)
    - audio            : path to sound file
    - photo            : path to insect photo
    - region           : short region string (e.g., "Eastern U.S.")
    - fact             : one or two sentences of natural history
    - photoCredit      : photographer name
    - audioCredit      : recordist name
    - copyrightPhoto   : license or rights statement for the photo
    - copyrightAudio   : license or rights statement for the audio

  You can remove a species from the game by deleting its object
  from the SONGS_DATA array. Please DO NOT delete existing species without written permission from the Admin.

*/

window.SONGS_DATA = [
  {
    commonName: "Four-spotted Tree Cricket",
    species: "Oecanthus quadripunctatus",
    spectrogramImage: "images/Four Spotted Tree Cricket_Spectogram_XC861325.jpeg",
    audio: "audio/XC861325 - Four-spotted tree cricket - Oecanthus quadripunctatus_Daniel_Parker.wav",
    photo: "images/Four Spotted Tree Cricket_Photo 100453434, no rights reserved, uploaded by Megan Ralph.jpg",
    region: "North America",
    fact: "Four-spotted tree crickets high pitched trills from up in the trees. They amplify their songs by building tools called baffles out of leaves.",
    photoCredit: "Megan Ralph",
    audioCredit: "Daniel Parker",
    // Fill these manually once you look up the licenses on iNaturalist / Xeno-canto
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "Swamp Cicada",
    species: "Neotibicen tibicen",
    spectrogramImage: "images/Neotibicen_tibicen_Spectrogram.jpeg",
    audio: "audio/Neotibicen_tibicen_australis_filtered_David_Marshall.mp3",
    photo: "images/Neotibicen tibicen_\"Alie\" Kratzer_Swamp Cicada.jpeg",
    region: "Eastern U.S.",
    fact: "Swamp cicadas produce loud songs by vibrating a thin membrane of an organ on their abdomen called a tymbal. Their songs are so loud that they actually turn down their hearing when they sing to avoid going deaf!",
    photoCredit: "\"Alie\" Kratzer",
    audioCredit: "David Marshall",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "Common True Katydid",
    species: "Pterophylla camellifolia",
    spectrogramImage: "images/Pterophylla camellifolia Common True Katydid spectrogram.jpeg",
    audio: "audio/XC1033657 - Pterophylla camellifolia_Francisco_Rivas_Fuenzalida.wav",
    photo: "images/Pterophylla camellifolia  Common true Katydid_Judy Gallagher_Image.jpg",
    region: "Eastern U.S. forests",
    fact: "Common true katydids produce rhythmic songs by rubbing their wings together. Unlike crickets who are righties, katydids are all lefties and rub their left wing over their right wings.",
    photoCredit: "Judy Gallagher",
    audioCredit: "Francisco Rivas Fuenzalida",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "Meadow Grasshopper",
    species: "Pseudochorthippus parallelus",
    spectrogramImage: "images/Meadow Grasshopper Spectrogram.jpeg",
    audio: "audio/XC446417 - Meadow Grasshopper - Pseudochorthippus parallelus_Baudewijn_Ode .mp3",
    photo: "images/Meadow Grasshopper_Gilles_San_Martin.jpg",
    region: "European grasslands",
    fact: "Male meadow grasshoppers create their percussive songs by rubbing their hind legs against hard forewings. Most grasshoppers don't actually sing, but some of the few species that do can be very easy to find.",
    photoCredit: "Gilles San Martin",
    audioCredit: "Baudewijn Ode",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "European Field Cricket",
    species: "Gryllus campestris",
    spectrogramImage: "images/Field Cricket spectogram.jpeg",
    audio: "audio/XC910555 - Field Cricket - Gryllus campestris_Cedric_Mroczko.mp3",
    photo: "images/European Field Cricket_Gilles_San_Martin.jpeg",
    region: "European grasslands",
    fact: "Field crickets dig simple burrows and sing from the entrance. Populations of European field crickets have rapidly declined due to habitat loss. Once they disappear from an area they rarely recover. They are now the most endangered cricket in Britain and conservation efforts are underway to reintroduce them to places they have gone extinct across Europe.",
    photoCredit: "Gilles San Martin",
    audioCredit: "Cedric Mroczko",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "European Mole Cricket",
    species: "Gryllotalpa gryllotalpa",
    spectrogramImage: "images/Mole Cricket Spectrogram.jpeg",
    audio: "audio/XC894246 - European mole cricket - Gryllotalpa gryllotalpa_Cedric_Mroczko.mp3",
    photo: "images/Gryllotalpa gryllotalpa_Grzegorz_Grzejszczak.jpeg",
    region: "Europe",
    fact: "Mole crickets are powerful diggers that build resonating burrows. These underground chambers act like acoustic amplifiers, greatly boosting the volume of their songs and showing how insects can use constructed spaces to enhance communication.",
    photoCredit: "Grzegorz Grzejszczak",
    audioCredit: "Cedric Mroczko",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "13-year Cicada",
    species: "Magicicada neotredecim",
    spectrogramImage: "images/13 year cicada spectrogram.jpeg",
    audio: "audio/11.US.IL.DAS.Magicicada_neotredecim_David_Marshall.mp3",
    photo: "images/13 year cicada_Kirill_Levchenko.jpeg",
    region: "Midwestern U.S.",
    fact: "Periodical cicadas spend 13 years underground feeding on tree roots before emerging in synchronized, spectacular numbers. Their unusual life cycle helps them avoid predators and overwhelm ecosystems with sheer abundance.",
    photoCredit: "Kirill Levchenko",
    audioCredit: "David Marshall",
    copyrightPhoto: "",
    copyrightAudio: ""
  },
  {
    commonName: "Sword-bearing Conehead",
    species: "Neoconocephalus ensiger",
    spectrogramImage: "images/Cone Head Katydid Spectrogram.jpeg",
    audio: "audio/XC859446 - Swordbearer - Neoconocephalus_Molly_Jacobson ensiger.mp3",
    photo: "images/Cone Head_Marlo_Perdicas.jpeg",
    region: "Eastern North America",
    fact: "Conehead katydids get their name from the pointed facial cone above their mouthparts. Females have a long, sword-like ovipositor used to insert eggs into plant stems, which is the origin of the “sword-bearing” name.",
    photoCredit: "Marlo Perdicas",
    audioCredit: "Molly Jacobson",
    copyrightPhoto: "",
    copyrightAudio: ""
  }

  /*
    --- TEMPLATE FOR ADDING A NEW SPECIES ---

    Copy this object into the array ABOVE (just before this comment block),
    add a comma after the previous entry, and then edit the fields.

  {
    commonName: "New Insect Common Name",
    species: "Genus species",
    spectrogramImage: "images/YourSpectrogramFileName.jpeg",
    audio: "audio/YourAudioFileName.wav",
    photo: "images/YourPhotoFileName.jpg",
    region: "Region or habitat (e.g., Eastern U.S.)",
    fact: "One or two sentences describing this insect's sound, behavior, or ecology.",
    photoCredit: "Photographer Name",
    audioCredit: "Recordist Name",
    copyrightPhoto: "License / rights statement for photo (e.g., CC BY, CC BY-NC, CC0, All rights reserved)",
    copyrightAudio: "License / rights statement for audio"
  }
  */
];
