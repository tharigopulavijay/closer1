export type Venue = {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  feeDue: number;
  checkIns: number;
};

export const VENUES: Venue[] = [
  { id: "niloufer", name: "Café Niloufer", area: "Lakdikapul", lat: 17.3985, lng: 78.4628, feeDue: 4200, checkIns: 38 },
  { id: "heartcup", name: "Heart Cup Coffee", area: "Jubilee Hills", lat: 17.4318, lng: 78.4074, feeDue: 1800, checkIns: 22 },
  { id: "roastery", name: "Roastery Coffee House", area: "Jubilee Hills", lat: 17.4254, lng: 78.4129, feeDue: 0, checkIns: 17 },
  { id: "chaiholic", name: "Chaiholic", area: "Gachibowli", lat: 17.4401, lng: 78.3489, feeDue: 2600, checkIns: 41 },
  { id: "olive", name: "Olive Bistro", area: "Hitech City", lat: 17.4474, lng: 78.3762, feeDue: 5100, checkIns: 12 },
];

export function venueById(id: string) {
  return VENUES.find((venue) => venue.id === id) ?? VENUES[0];
}

export const QUIZ = [
  {
    q: "Ramoji Film City sits towards which side of Hyderabad?",
    options: ["Gachibowli", "Hayathnagar", "Secunderabad", "Old City"],
    answer: 1,
  },
  {
    q: "Who composed the score for Baahubali?",
    options: ["S. S. Rajamouli", "M. M. Keeravani", "Devi Sri Prasad", "Anirudh Ravichander"],
    answer: 1,
  },
  {
    q: "Who directed C/o Kancharapalem?",
    options: ["Venky Atluri", "Venkatesh Maha", "Tharun Bhascker", "Nag Ashwin"],
    answer: 1,
  },
  {
    q: "Charminar was commissioned by which Qutb Shahi ruler?",
    options: ["Quli Qutb Shah", "Abdullah Qutb Shah", "Muhammad Quli Qutb Shah", "Jamsheed Quli"],
    answer: 2,
  },
  {
    q: "Which of these is a Hyderabadi bakery savoury?",
    options: ["Dhokla", "Lukhmi", "Vada pav", "Sandesh"],
    answer: 1,
  },
  {
    q: "Tollywood, in this city, means films in which language?",
    options: ["Hindi", "Tamil", "Telugu", "Kannada"],
    answer: 2,
  },
  {
    q: "Who sang Inkem Inkem?",
    options: ["Sid Sriram", "Armaan Malik", "Anirudh", "Karthik"],
    answer: 0,
  },
  {
    q: "Which lake sits in the middle of the city?",
    options: ["Chilika", "Dal", "Hussain Sagar", "Osman Sagar"],
    answer: 2,
  },
  {
    q: "The pearl market beside Charminar is known as?",
    options: ["Laad Bazaar", "Sultan Bazaar", "Begum Bazaar", "Shilparamam"],
    answer: 0,
  },
  {
    q: "Hyderabad FC play their home matches at?",
    options: ["Gachibowli Stadium", "Lal Bahadur Shastri Stadium", "Rajiv Gandhi Stadium", "Uppal Indoor"],
    answer: 0,
  },
];

export const THIS_OR_THAT = [
  ["Irani chai", "Filter coffee"],
  ["Old City", "Jubilee Hills"],
  ["A morning walk", "A late dinner"],
  ["Telugu films", "Hindi films"],
  ["Rain on a terrace", "Winter sun"],
  ["Cooking", "Being cooked for"],
  ["Phones down", "A shared playlist"],
  ["One close friend", "A full table"],
];

export const ANTAKSHARI_LETTERS = ["S", "M", "R", "K", "P", "N", "L", "A", "B", "D", "G", "T"];

export const SAATHI_OPENERS = [
  "I'm Saathi, an AI. I am not a person on Closer, and I can't meet you.",
  "Tell me how you want tonight to feel. I can help you word a note, or just listen.",
];
