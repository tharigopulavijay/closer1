# Reference material (not built, not shipped)

- `designs/`: the 55 approved screen designs (compressed JPGs; the number at the end of each name is the screen order).
- `gemini-ui/src/`: Gemini's front end. **Copy its look, not its logic.** Its data is hardcoded and its SOS, hashing and admin access are fake.
- `sample-people/`: AI-generated sample portraits (not real people) for preview mode: `ananya.png`, `sameera.png`, `divya.png`, and `arjun1.png`–`arjun3.png` for the signed-in user.

## Known mistakes in the designs: do NOT copy these
1. Tab bar icons must always be: Drop = Moon, Rooms = Mic, Play = Gamepad2, Plans = CalendarDays, You = User (lucide-react).
2. The active tab must match the screen (the live room = Rooms; Date day = Plans).
3. Contacts: "Hide me from all my contacts" is ON by default, plus an allow-list. Not "Block selected contacts", OFF.
4. Ludo: 4 distinct colours: marigold, mint, lavender, coral.
5. Emergency screen: calm shield and city background, no frightened face. SOS never asks for extra confirmation.
6. The admin screens must not use "Arjun K." as an offender, and dates are 2026.
7. Charminar header images only on Welcome and the Drop; other screens use plain dark headers.
