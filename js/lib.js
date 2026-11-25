// Built-in exercise library and routine templates.
// Nothing personal lives here: a person's own workouts, routines and custom
// exercises are stored on their device and arrive by logging or importing.

export const CATS = {
  m: { name: 'Machine', short: 'Machine' },
  f: { name: 'Free Weight', short: 'Free Weight' },
  b: { name: 'Bodyweight', short: 'Bodyweight' },
  c: { name: 'Cardio', short: 'Cardio' },
  y: { name: 'Yoga / Mobility', short: 'Yoga' },
};
export const CAT_ORDER = ['m', 'f', 'b', 'c', 'y'];

// How an exercise is logged. Each type lists the fields shown in the set table.
//   w = weight (lb), r = reps, t = time in seconds, m = time in minutes (stored
//   as seconds in `t`), d = distance (mi)
export const TYPES = {
  wr: { name: 'Weight + reps', fields: ['w', 'r'] },
  r: { name: 'Reps only', fields: ['r'] },
  t: { name: 'Timed hold (seconds)', fields: ['t'] },
  c: { name: 'Distance + minutes', fields: ['d', 'm'] },
  wd: { name: 'Weight + distance', fields: ['w', 'd'] },
  tm: { name: 'Time only (minutes)', fields: ['m'] },
};

export const FIELDS = {
  w: { key: 'w', head: 'LB', label: 'Weight', unit: 'lb', step: 2.5, dec: true, chips: [] },
  r: { key: 'r', head: 'REPS', label: 'Reps', unit: 'reps', step: 1, dec: false, chips: [5, 8, 10, 12, 15, 20] },
  t: { key: 't', head: 'TIME', label: 'Time', unit: 'sec', step: 5, dec: false, chips: [30, 45, 60, 90, 120] },
  m: { key: 't', head: 'MIN', label: 'Time', unit: 'min', step: 1, dec: true, chips: [10, 15, 20, 30, 45, 60], scale: 60 },
  d: { key: 'd', head: 'MI', label: 'Distance', unit: 'mi', step: 0.1, dec: true, chips: [1, 2, 3, 5] },
};

// [id, name, category, muscle, equipment, type, form cue, other names it may arrive under]
const L = [
  // ── Machine ──
  ['leg-press', 'Leg Press', 'm', 'Quads', 'Machine', 'wr', 'Feet shoulder-width, lower until knees reach 90°, press without locking out', ['Leg Press (Machine)', 'Leg Press Horizontal (Machine)']],
  ['leg-extension', 'Leg Extension', 'm', 'Quads', 'Machine', 'wr', 'Pad on the shin, extend smoothly, pause at the top', ['Leg Extension (Machine)']],
  ['leg-curl', 'Seated Leg Curl', 'm', 'Hamstrings', 'Machine', 'wr', 'Thigh pad snug, curl heels under, control the return', ['Seated Leg Curl (Machine)']],
  ['lying-leg-curl', 'Lying Leg Curl', 'm', 'Hamstrings', 'Machine', 'wr', 'Hips down on the pad, curl to the glutes, slow on the way back', ['Lying Leg Curl (Machine)']],
  ['hack-squat', 'Hack Squat', 'm', 'Quads', 'Machine', 'wr', 'Back flat on the pad, sit deep, drive through the whole foot', ['Hack Squat (Machine)']],
  ['smith-squat', 'Smith Machine Squat', 'm', 'Quads', 'Smith machine', 'wr', 'Feet slightly forward, chest up, sit straight down', ['Squat (Smith Machine)']],
  ['calf-machine', 'Seated Calf Raise Machine', 'm', 'Calves', 'Machine', 'wr', 'Full stretch at the bottom, squeeze and pause at the top', ['Seated Calf Raise', 'Seated Calf Raise (Machine)']],
  ['hip-abduction', 'Hip Abduction', 'm', 'Glutes', 'Machine', 'wr', 'Sit tall, press knees apart, return slowly', ['Hip Abduction (Machine)']],
  ['hip-adduction', 'Hip Adduction', 'm', 'Adductors', 'Machine', 'wr', 'Sit tall, squeeze knees together, return slowly', ['Hip Adduction (Machine)']],
  ['glute-kickback', 'Glute Kickback Machine', 'm', 'Glutes', 'Machine', 'wr', 'Brace the core, press the heel back, no arching', ['Glute Kickback (Machine)']],
  ['chest-press-machine', 'Chest Press Machine', 'm', 'Chest', 'Machine', 'wr', 'Handles at mid-chest, shoulder blades back, press and return slowly', ['Chest Press (Machine)']],
  ['incline-press-machine', 'Incline Chest Press Machine', 'm', 'Chest', 'Machine', 'wr', 'Press up and slightly in, elbows below shoulders', ['Incline Chest Press (Machine)']],
  ['pec-deck', 'Pec Deck / Machine Fly', 'm', 'Chest', 'Machine', 'wr', 'Slight bend in the elbows, hug the handles together, open under control', ['Butterfly (Pec Deck)', 'Pec Deck', 'Chest Fly (Machine)']],
  ['cable-fly', 'Cable Fly', 'm', 'Chest', 'Cable', 'wr', 'Step forward, soft elbows, bring hands together in an arc', ['Cable Fly Crossovers']],
  ['shoulder-press-machine', 'Shoulder Press Machine', 'm', 'Shoulders', 'Machine', 'wr', 'Back against the pad, press overhead without shrugging', ['Seated Shoulder Press (Machine)', 'Shoulder Press (Machine)']],
  ['cable-lateral', 'Cable Lateral Raise', 'm', 'Shoulders', 'Cable', 'wr', 'Lead with the elbow, raise to shoulder height, lower slowly', ['Lateral Raise (Cable)']],
  ['rear-delt-machine', 'Rear Delt Fly Machine', 'm', 'Shoulders', 'Machine', 'wr', 'Chest on the pad, sweep arms back, squeeze the shoulder blades', ['Rear Delt Reverse Fly (Machine)', 'Reverse Fly (Machine)']],
  ['lat-pulldown', 'Lat Pulldown', 'm', 'Lats', 'Cable', 'wr', 'Chest tall, pull the bar to the collarbone, elbows down and back', ['Lat Pulldown (Cable)']],
  ['seated-row', 'Seated Cable Row', 'm', 'Back', 'Cable', 'wr', 'Sit tall, pull to the lower ribs, squeeze, reach forward under control', ['Seated Cable Row (Cable)', 'Seated Row (Cable)']],
  ['assisted-pullup', 'Assisted Pull-Up', 'm', 'Lats', 'Machine', 'wr', 'Full hang, pull chest to the bar, lower all the way', ['Pull Up (Assisted)']],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown', 'm', 'Lats', 'Cable', 'wr', 'Arms long, sweep the bar to the thighs, ribs down', ['Straight Arm Lat Pulldown (Cable)']],
  ['face-pull', 'Face Pull', 'm', 'Shoulders', 'Cable', 'wr', 'Rope to eye level, elbows high, pull apart at the end', []],
  ['tricep-pushdown', 'Tricep Pushdown', 'm', 'Triceps', 'Cable', 'wr', 'Elbows pinned to the ribs, press down to lockout', ['Triceps Pushdown']],
  ['cable-curl', 'Cable Bicep Curl', 'm', 'Biceps', 'Cable', 'wr', 'Elbows still, curl up, lower slowly', ['Bicep Curl (Cable)']],
  ['cable-crunch', 'Cable Crunch', 'm', 'Core', 'Cable', 'wr', 'Kneel, round the spine, bring elbows toward knees', []],
  ['back-extension-machine', 'Back Extension Machine', 'm', 'Lower back', 'Machine', 'wr', 'Hinge at the hips, extend to neutral, no leaning back', ['Back Extension (Machine)']],

  // ── Free weight ──
  ['squat', 'Barbell Back Squat', 'f', 'Quads', 'Barbell', 'wr', 'Brace, sit between the hips, knees track over toes, drive up', ['Squat (Barbell)']],
  ['front-squat', 'Front Squat', 'f', 'Quads', 'Barbell', 'wr', 'Elbows high, torso upright, sit straight down', ['Front Squat (Barbell)']],
  ['goblet-squat', 'Goblet Squat', 'f', 'Quads', 'Dumbbell', 'wr', 'Hold the weight at the chest, elbows inside knees, sit deep', []],
  ['deadlift', 'Deadlift', 'f', 'Back', 'Barbell', 'wr', 'Bar over mid-foot, flat back, push the floor away, stand tall', ['Deadlift (Barbell)']],
  ['romanian-dl', 'Romanian Deadlift', 'f', 'Hamstrings', 'Barbell', 'wr', 'Soft knees, push hips back, bar close to the legs', ['Romanian Deadlift (Barbell)']],
  ['db-rdl', 'Dumbbell Romanian Deadlift', 'f', 'Hamstrings', 'Dumbbell', 'wr', 'Hinge at the hips with a flat back, feel the hamstrings, stand tall', ['Romanian Deadlift (Dumbbell)']],
  ['barbell-bench', 'Barbell Bench Press', 'f', 'Chest', 'Barbell', 'wr', 'Shoulder blades pinned, bar to mid-chest, press up and back', ['Bench Press (Barbell)']],
  ['incline-bench', 'Incline Barbell Bench', 'f', 'Chest', 'Barbell', 'wr', 'Bench at 30°, bar to the upper chest, wrists over elbows', ['Incline Bench Press (Barbell)']],
  ['db-bench', 'Dumbbell Bench Press', 'f', 'Chest', 'Dumbbell', 'wr', 'Dumbbells over the chest, lower to the sides, press together', ['Bench Press (Dumbbell)']],
  ['incline-db-press', 'Incline Dumbbell Press', 'f', 'Chest', 'Dumbbell', 'wr', 'Bench at 30°, elbows 45° from the body, press up', ['Incline Bench Press (Dumbbell)']],
  ['db-fly', 'Dumbbell Fly', 'f', 'Chest', 'Dumbbell', 'wr', 'Soft elbows, open wide to a stretch, hug back up', ['Chest Fly (Dumbbell)']],
  ['ohp', 'Overhead Press', 'f', 'Shoulders', 'Barbell', 'wr', 'Glutes tight, press straight up, head through at the top', ['Overhead Press (Barbell)']],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'f', 'Shoulders', 'Dumbbell', 'wr', 'Start at ear height, press overhead, lower under control', ['Overhead Press (Dumbbell)', 'Shoulder Press (Dumbbell)']],
  ['arnold-press', 'Arnold Press', 'f', 'Shoulders', 'Dumbbell', 'wr', 'Palms in at the bottom, rotate out as you press', ['Arnold Press (Dumbbell)']],
  ['lateral-raise', 'Lateral Raise', 'f', 'Shoulders', 'Dumbbell', 'wr', 'Slight lean, raise to shoulder height, pinkies no higher than thumbs', ['Lateral Raise (Dumbbell)']],
  ['front-raise', 'Front Raise', 'f', 'Shoulders', 'Dumbbell', 'wr', 'Raise to eye level, no swinging, lower slowly', ['Front Raise (Dumbbell)']],
  ['barbell-row', 'Barbell Row', 'f', 'Back', 'Barbell', 'wr', 'Hinge to 45°, pull to the belly button, flat back', ['Bent Over Row (Barbell)']],
  ['db-row', 'One-Arm Dumbbell Row', 'f', 'Back', 'Dumbbell', 'wr', 'Hand and knee on the bench, pull the elbow to the hip', ['Dumbbell Row']],
  ['db-shrug', 'Dumbbell Shrug', 'f', 'Traps', 'Dumbbell', 'wr', 'Shoulders straight up to the ears, pause, lower', ['Shrug (Dumbbell)']],
  ['bicep-curl', 'Dumbbell Bicep Curl', 'f', 'Biceps', 'Dumbbell', 'wr', 'Elbows at the sides, curl without swinging', ['Bicep Curl (Dumbbell)']],
  ['hammer-curl', 'Hammer Curl', 'f', 'Biceps', 'Dumbbell', 'wr', 'Palms facing in, curl to the shoulder', ['Hammer Curl (Dumbbell)']],
  ['ez-curl', 'EZ-Bar Curl', 'f', 'Biceps', 'EZ bar', 'wr', 'Elbows still, curl to the chin, lower slowly', ['EZ Bar Biceps Curl']],
  ['tricep-extension', 'Overhead Tricep Extension', 'f', 'Triceps', 'Dumbbell', 'wr', 'Elbows pointing up, lower behind the head, extend', ['Triceps Extension (Dumbbell)']],
  ['skull-crusher', 'Skull Crusher', 'f', 'Triceps', 'EZ bar', 'wr', 'Upper arms vertical, lower to the forehead, extend', ['Skullcrusher (Barbell)']],
  ['db-lunge', 'Dumbbell Lunge', 'f', 'Quads', 'Dumbbell', 'wr', 'Long step, back knee toward the floor, push through the front heel', ['Lunge (Dumbbell)']],
  ['bulgarian', 'Bulgarian Split Squat', 'f', 'Quads', 'Dumbbell + bench', 'wr', 'Back foot on the bench, drop straight down, front knee over the foot', []],
  ['hip-thrust', 'Hip Thrust', 'f', 'Glutes', 'Barbell + bench', 'wr', 'Shoulders on the bench, drive hips up, chin tucked, squeeze', ['Hip Thrust (Barbell)']],
  ['calf-raise-db', 'Standing Calf Raise (Dumbbell)', 'f', 'Calves', 'Dumbbell', 'wr', 'Rise onto the toes, pause, lower to a full stretch', []],
  ['kettlebell-swing', 'Kettlebell Swing', 'f', 'Glutes', 'Kettlebell', 'wr', 'Hike it back, snap the hips, let the bell float to chest height', []],
  ['farmer-carry', "Farmer's Carry", 'f', 'Grip', 'Dumbbell', 't', 'Stand tall, shoulders back, walk with short steady steps', []],

  // ── Bodyweight ──
  ['pushup', 'Push-Up', 'b', 'Chest', 'None', 'r', 'Straight line head to heels, chest to the floor, press up', ['Push Up']],
  ['incline-pushup', 'Incline Push-Up', 'b', 'Chest', 'Bench', 'r', 'Hands on a bench, body straight, chest to the edge', []],
  ['pullup', 'Pull-Up', 'b', 'Lats', 'Bar', 'r', 'Full hang, pull the chest to the bar, lower all the way', ['Pull Up']],
  ['chinup', 'Chin-Up', 'b', 'Lats', 'Bar', 'r', 'Palms toward you, pull the chin over the bar', ['Chin Up']],
  ['dip', 'Dip', 'b', 'Triceps', 'Bars', 'r', 'Lean slightly forward, lower to 90°, press up', []],
  ['bench-dip', 'Bench Dip', 'b', 'Triceps', 'Bench', 'r', 'Hands behind on the bench, lower with elbows back, press up', []],
  ['bw-squat', 'Bodyweight Squat', 'b', 'Quads', 'None', 'r', 'Arms forward, sit back and down, stand tall', ['Squat (Bodyweight)']],
  ['sit-to-stand', 'Sit-to-Stand', 'b', 'Quads', 'Chair', 'r', 'Sit lightly, stand without using the hands, control the way down', []],
  ['step-up', 'Step-Up', 'b', 'Quads', 'Step', 'r', 'Whole foot on the step, drive up through the heel, lower slowly', ['Step Up']],
  ['walking-lunge', 'Walking Lunge', 'b', 'Quads', 'None', 'r', 'Long steps, torso tall, back knee just above the floor', []],
  ['glute-bridge', 'Glute Bridge', 'b', 'Glutes', 'Mat', 'r', 'Heels close, drive the hips up, squeeze for a second', []],
  ['single-leg-bridge', 'Single-Leg Glute Bridge', 'b', 'Glutes', 'Mat', 'r', 'One leg extended, hips level, drive up through the heel', []],
  ['bw-calf-raise', 'Bodyweight Calf Raise', 'b', 'Calves', 'None', 'r', 'Rise high onto the toes, pause, lower slowly', []],
  ['plank', 'Plank', 'b', 'Core', 'Mat', 't', 'Elbows under shoulders, straight line, breathe', []],
  ['side-plank', 'Side Plank', 'b', 'Core', 'Mat', 't', 'Elbow under the shoulder, hips high, body in one line', []],
  ['dead-bug', 'Dead Bug', 'b', 'Core', 'Mat', 'r', 'Lower back pressed down, reach opposite arm and leg, slow', []],
  ['bird-dog', 'Bird Dog', 'b', 'Core', 'Mat', 'r', 'Reach opposite arm and leg long, hips square, pause', []],
  ['hollow-hold', 'Hollow Hold', 'b', 'Core', 'Mat', 't', 'Lower back down, arms and legs long, hold the dish shape', []],
  ['wall-sit', 'Wall Sit', 'b', 'Quads', 'Wall', 't', 'Back flat on the wall, thighs parallel, hold', []],
  ['mountain-climber', 'Mountain Climber', 'b', 'Core', 'None', 'r', 'Plank position, drive the knees in one at a time, hips low', []],
  ['bicycle-crunch', 'Bicycle Crunch', 'b', 'Core', 'Mat', 'r', 'Elbow toward the opposite knee, slow and controlled', []],
  ['crunch', 'Crunch', 'b', 'Core', 'Mat', 'r', 'Ribs toward hips, shoulders off the floor, neck relaxed', []],
  ['hanging-knee-raise', 'Hanging Knee Raise', 'b', 'Core', 'Bar', 'r', 'Hang tall, bring the knees to the chest without swinging', []],
  ['leg-raise', 'Leg Raise', 'b', 'Core', 'Mat', 'r', 'Lower back down, raise straight legs, lower slowly', ['Lying Leg Raise']],
  ['russian-twist', 'Russian Twist', 'b', 'Core', 'Mat', 'r', 'Lean back, rotate the ribs side to side, chest tall', []],
  ['back-extension', 'Back Extension (Hyperextension)', 'b', 'Lower back', 'Bench', 'r', 'Hinge at the hips, rise to a straight line, no over-arching', ['Back Extension']],
  ['dead-hang', 'Dead Hang', 'b', 'Grip', 'Bar', 't', 'Full grip, shoulders active, breathe and hang', []],
  ['inverted-row', 'Inverted Row', 'b', 'Back', 'Bar', 'r', 'Body straight under the bar, pull the chest up, lower slowly', []],
  ['burpee', 'Burpee', 'b', 'Full body', 'None', 'r', 'Hands down, jump back, chest to the floor, jump up', []],
  ['balance-reach', 'Single-Leg Balance Reach', 'b', 'Balance', 'None', 't', 'Stand on one leg, reach the other foot forward, side, back', []],

  // ── Cardio ──
  ['treadmill-run', 'Treadmill Run', 'c', 'Cardio', 'Treadmill', 'c', 'Easy pace you could talk at, light quick steps', ['Treadmill']],
  ['treadmill-walk', 'Treadmill Incline Walk', 'c', 'Cardio', 'Treadmill', 'c', 'Raise the incline, stride naturally, hands off the rails', []],
  ['walk', 'Outdoor Walk', 'c', 'Cardio', 'None', 'c', 'Brisk pace, arms swinging, tall posture', ['Walking']],
  ['dog-walk', 'Dog Walk', 'c', 'Cardio', 'None', 'c', 'Easy pace, and the dog sets the stops', ['Dog Walking', 'Walk the dog']],
  ['run', 'Outdoor Run', 'c', 'Cardio', 'None', 'c', 'Relaxed shoulders, quick cadence, breathe steadily', ['Running']],
  ['stationary-bike', 'Stationary Bike', 'c', 'Cardio', 'Bike', 'c', 'Seat at hip height, steady cadence, light grip', []],
  ['cycling', 'Outdoor Cycling', 'c', 'Cardio', 'Bike', 'c', 'Smooth circles, steady effort, look ahead', ['Cycling']],
  ['elliptical', 'Elliptical', 'c', 'Cardio', 'Elliptical', 'c', 'Stand tall, push and pull the handles, full strides', ['Elliptical Trainer']],
  ['rowing', 'Rowing Machine', 'c', 'Cardio', 'Rower', 'c', 'Legs, then lean, then arms; reverse on the way back', ['Rowing Machine']],
  ['stair-climber', 'Stair Climber', 'c', 'Cardio', 'Machine', 'c', 'Whole foot on each step, light on the rails', ['Stair Machine']],
  ['swimming', 'Swimming', 'c', 'Cardio', 'Pool', 'c', 'Long strokes, steady breathing', []],
  ['jump-rope', 'Jump Rope', 'c', 'Cardio', 'Rope', 'c', 'Small hops, wrists turn the rope, stay on the balls of the feet', []],
  ['hiking', 'Hiking', 'c', 'Cardio', 'None', 'c', 'Steady pace, shorten the stride on climbs', []],

  // ── Yoga / mobility ──
  ['cat-cow', 'Cat-Cow Flow', 'y', 'Spine', 'Mat', 't', 'Round and arch the spine slowly with the breath', []],
  ['sun-salutation', 'Sun Salutation Flow', 'y', 'Full body', 'Mat', 't', 'Move one breath per pose, smooth and unhurried', []],
  ['downward-dog', 'Downward Dog', 'y', 'Hamstrings', 'Mat', 't', 'Hips high, long spine, heels reaching down', []],
  ['childs-pose', "Child's Pose", 'y', 'Back', 'Mat', 't', 'Knees wide, hips to heels, forehead down, breathe', []],
  ['warrior-1', 'Warrior I', 'y', 'Hips', 'Mat', 't', 'Front knee over the ankle, hips square, arms up', []],
  ['warrior-2', 'Warrior II', 'y', 'Hips', 'Mat', 't', 'Front knee bent, arms long, gaze over the front hand', []],
  ['tree-pose', 'Tree Pose', 'y', 'Balance', 'Mat', 't', 'Foot on the calf or thigh (not the knee), stand tall', []],
  ['pigeon', 'Pigeon Pose', 'y', 'Hips', 'Mat', 't', 'Front shin angled, hips square, fold forward gently', []],
  ['cobra', 'Cobra', 'y', 'Spine', 'Mat', 't', 'Press the chest forward and up, shoulders down', []],
  ['bridge-pose', 'Bridge Pose', 'y', 'Glutes', 'Mat', 't', 'Feet under the knees, lift the hips, chest toward the chin', []],
  ['forward-fold', 'Seated Forward Fold', 'y', 'Hamstrings', 'Mat', 't', 'Long spine first, then fold from the hips', []],
  ['supine-twist', 'Supine Twist', 'y', 'Spine', 'Mat', 't', 'Knees to one side, shoulders down, breathe into the ribs', []],
  ['legs-up-wall', 'Legs Up the Wall', 'y', 'Recovery', 'Wall', 't', 'Hips near the wall, legs resting up, relax', []],
  ['hip-flexor-stretch', 'Hip Flexor Stretch', 'y', 'Hips', 'Mat', 't', 'Half-kneel, tuck the tailbone, shift gently forward', []],
  ['hamstring-stretch', 'Hamstring Stretch', 'y', 'Hamstrings', 'Mat', 't', 'One leg long, hinge forward with a flat back', []],
  ['thoracic-rotation', 'Thoracic Rotation', 'y', 'Spine', 'Mat', 't', 'On all fours, hand behind the head, rotate the elbow up', []],
  ['breathwork', 'Breathwork', 'y', 'Recovery', 'None', 't', 'In through the nose for four, out slowly for six', []],
  ['foam-rolling', 'Foam Rolling', 'y', 'Recovery', 'Roller', 't', 'Slow passes, pause on tight spots, keep breathing', []],
  ['matt', 'Matt', 'y', 'Full body', 'Mat', 'tm', 'A mat routine, logged as one block of minutes', ['Mat', 'Mat routine', 'Mat work']],
  ['yoga-session', 'Yoga Session', 'y', 'Full body', 'Mat', 't', 'A full class or free practice, logged as one block', ['Yoga']],
];

export const BUILTIN = L.map(([id, name, cat, muscle, equip, type, cue, aka]) => ({
  id, name, cat, muscle, equip, type, cue, aka: aka || [], builtin: true,
}));

// Routine templates. Each exercise: [library id, number of sets, target for each set]
const R = (id, name, desc, list, extra = {}) => ({
  id, name, desc, ...extra,
  exercises: list.map(([exId, n, target]) => ({ exId, sets: Array.from({ length: n }, () => ({ ...target })) })),
});

export const STARTERS = [
  R('st-push', 'Push Day', 'Chest / Shoulders / Triceps', [
    ['barbell-bench', 3, { r: 10 }], ['incline-bench', 3, { r: 10 }], ['ohp', 3, { r: 10 }], ['lateral-raise', 3, { r: 12 }], ['tricep-pushdown', 3, { r: 12 }]]),
  R('st-pull', 'Pull Day', 'Back / Biceps', [
    ['deadlift', 3, { r: 8 }], ['lat-pulldown', 3, { r: 10 }], ['seated-row', 3, { r: 10 }], ['bicep-curl', 3, { r: 12 }], ['hammer-curl', 3, { r: 12 }]]),
  R('st-legs', 'Leg Day', 'Quads / Hams / Calves', [
    ['squat', 3, { r: 10 }], ['leg-press', 3, { r: 10 }], ['romanian-dl', 3, { r: 10 }], ['leg-curl', 3, { r: 12 }], ['calf-machine', 3, { r: 15 }]]),
  R('st-full', 'Full Body A', 'Squat + Press + Pull', [
    ['squat', 3, { r: 10 }], ['barbell-bench', 3, { r: 10 }], ['barbell-row', 3, { r: 10 }], ['plank', 2, { t: 45 }]]),
  R('st-yoga', 'Morning Yoga + Core', 'Mobility & core in 25 min', [
    ['cat-cow', 1, { t: 60 }], ['sun-salutation', 1, { t: 300 }], ['warrior-2', 2, { t: 60 }], ['pigeon', 2, { t: 90 }], ['dead-bug', 2, { r: 10 }], ['childs-pose', 1, { t: 120 }]]),
  R('st-cardio', 'Cardio + Core', 'Steady cardio finisher', [
    ['treadmill-walk', 1, { t: 1200, d: 1 }], ['rowing', 1, { t: 600 }], ['plank', 2, { t: 45 }], ['side-plank', 2, { t: 30 }]]),
];

export const AGE_SMART = [
  R('as-a', '55+ Full-Body Foundation A', 'Machine + dumbbell strength for every major muscle group. Day 1 · alternate with Foundation B.', [
    ['leg-press', 2, { r: 12 }], ['chest-press-machine', 2, { r: 11 }], ['seated-row', 2, { r: 12 }], ['db-rdl', 2, { r: 10 }], ['dead-bug', 2, { r: 10 }], ['farmer-carry', 2, { t: 40 }]],
    { tag: 'Start here', mins: 45, level: 'Beginner-friendly', when: 'Day 1', gear: 'Machines + dumbbells', why: 'Machines guide the path of each lift, so joints stay comfortable while every major muscle group gets loaded.' }),
  R('as-b', '55+ Full-Body Foundation B', 'The second half of the pair. Day 3 · at least 48 hours after A.', [
    ['goblet-squat', 2, { r: 10 }], ['lat-pulldown', 2, { r: 12 }], ['leg-curl', 2, { r: 12 }], ['db-shoulder-press', 2, { r: 10 }], ['glute-bridge', 2, { r: 12 }], ['bird-dog', 2, { r: 8 }], ['calf-raise-db', 2, { r: 12 }]],
    { tag: 'Pairs with A', mins: 45, level: 'Beginner-friendly', when: 'Day 3', gear: 'Machines + dumbbells', why: 'Different movements from A, so the same muscles get worked from new angles with a full recovery gap between.' }),
  R('as-db', '55+ Dumbbell-Only Home Strength', 'A complete session with a pair of dumbbells and a bench or chair.', [
    ['goblet-squat', 3, { r: 10 }], ['db-bench', 3, { r: 10 }], ['db-row', 3, { r: 10 }], ['db-rdl', 3, { r: 10 }], ['db-shoulder-press', 2, { r: 10 }], ['hammer-curl', 2, { r: 12 }], ['plank', 2, { t: 45 }]],
    { tag: 'No gym needed', mins: 40, level: 'All levels', when: 'Twice a week', gear: 'Dumbbells + bench', why: 'Free weights train balance and coordination along with strength, and the whole thing fits in a living room.' }),
  R('as-legs', '55+ Strong Legs, Knees & Balance', 'Leg strength and steadiness — the best protection against falls.', [
    ['sit-to-stand', 2, { r: 10 }], ['step-up', 2, { r: 8 }], ['leg-extension', 2, { r: 12 }], ['leg-curl', 2, { r: 12 }], ['bw-calf-raise', 2, { r: 15 }], ['tree-pose', 2, { t: 30 }], ['balance-reach', 2, { t: 30 }]],
    { tag: 'Balance', mins: 35, level: 'All levels', when: 'Once or twice a week', gear: 'Chair, step, machines', why: 'Combines the strength that protects knees with the single-leg balance work that keeps you steady.' }),
  R('as-cardio', '55+ Low-Impact Cardio Engine', 'Four machines, forty minutes, nothing pounding the joints.', [
    ['treadmill-walk', 1, { t: 900 }], ['stationary-bike', 1, { t: 600 }], ['rowing', 1, { t: 480 }], ['elliptical', 1, { t: 420 }]],
    { tag: 'Heart health', mins: 40, level: 'All levels', when: 'Two or three times a week', gear: 'Cardio machines', why: 'Rotating machines spreads the load across different joints while the heart works the whole time.' }),
  R('as-mobility', '55+ Mobility, Core & Recovery', 'A mat-only session for rest days and evenings.', [
    ['cat-cow', 1, { t: 60 }], ['sun-salutation', 1, { t: 300 }], ['warrior-2', 2, { t: 60 }], ['pigeon', 2, { t: 90 }], ['dead-bug', 2, { r: 10 }], ['childs-pose', 1, { t: 120 }], ['legs-up-wall', 1, { t: 300 }], ['breathwork', 1, { t: 300 }]],
    { tag: 'Recovery', mins: 30, level: 'All levels', when: 'Rest days', gear: 'Mat', why: 'Keeps hips, spine and shoulders moving freely so the strength days feel better.' }),
];

// Plans: which routine to do on which day. Each plan is a cycle of days that
// repeats from the date the person chooses as day 1.
//   kind: s strength · c cardio · y mobility · w walk · r rest
const D = {
  a: { tpl: 'as-a', label: 'Foundation A', short: 'A', kind: 's' },
  b: { tpl: 'as-b', label: 'Foundation B', short: 'B', kind: 's' },
  db: { tpl: 'as-db', label: 'Dumbbell Strength', short: 'DB', kind: 's' },
  legs: { tpl: 'as-legs', label: 'Legs & Balance', short: 'Legs', kind: 's' },
  cardio: { tpl: 'as-cardio', label: 'Cardio Engine', short: 'Cardio', kind: 'c' },
  mob: { tpl: 'as-mobility', label: 'Mobility & Core', short: 'Mob', kind: 'y' },
  push: { tpl: 'st-push', label: 'Push Day', short: 'Push', kind: 's' },
  pull: { tpl: 'st-pull', label: 'Pull Day', short: 'Pull', kind: 's' },
  leg: { tpl: 'st-legs', label: 'Leg Day', short: 'Legs', kind: 's' },
  walk: { label: 'Easy walk', short: 'Walk', kind: 'w', mins: 25 },
  rest: { label: 'Rest', short: 'Rest', kind: 'r' },
};
export const PLANS = [
  {
    id: 'p-55-ab', name: '55+ Foundation A / B', tag: 'Start here',
    desc: 'Two full-body strength days a week, with easy walks between them. The simplest way to use Foundation A and B.',
    how: [
      'Foundation A on day 1 and Foundation B on day 3, every week. That leaves at least 48 hours before the same muscles work again.',
      'Walk days are easy: 20 to 30 minutes at a pace where you can still talk. A dog walk counts.',
      'One mobility day keeps hips, spine and shoulders moving. The last day is a full rest.',
      'Stay with it for four to six weeks. When every set feels steady, move up to the 55+ Full week.',
    ],
    cycle: [D.a, D.walk, D.b, D.walk, D.mob, D.walk, D.rest],
  },
  {
    id: 'p-55-week', name: '55+ Full week',
    desc: 'The whole collection across seven days: three strength days, two cardio days, one mobility day and one rest day.',
    how: [
      'Strength on days 1, 3 and 5 (Foundation A, Foundation B, Legs & Balance), always with a day between.',
      'Cardio on days 2 and 6. Swap the machine circuit for a brisk walk any time.',
      'Mobility on day 4 and a full rest on day 7. Gentle yoga on the rest day is fine.',
      'Add a short daily walk to reach the 150 minutes of cardio a week the guidelines suggest.',
    ],
    cycle: [D.a, D.cardio, D.b, D.mob, D.legs, D.cardio, D.rest],
  },
  {
    id: 'p-55-home', name: '55+ Home week',
    desc: 'For weeks without a gym: dumbbells twice, walks and a mat session in between.',
    how: [
      'Dumbbell Strength on day 1 and day 4: twice a week with two days between.',
      'Walk on the days after strength, and do the mat session on day 3.',
      'If the dumbbells start to feel light for every set, go up one size on the big lifts first.',
    ],
    cycle: [D.db, D.walk, D.mob, D.db, D.walk, D.walk, D.rest],
  },
  {
    id: 'p-ppl', name: 'Push / Pull / Legs',
    desc: 'Three lifting days a week, each muscle group once.',
    how: [
      'Push on day 1, Pull on day 3, Legs on day 5.',
      'The days between are rest. A walk or some easy cardio is welcome but optional.',
      'Add weight only when every set reaches its target reps with good form.',
    ],
    cycle: [D.push, D.rest, D.pull, D.rest, D.leg, D.rest, D.rest],
  },
];

// Guess a muscle group from an exercise name (used for imported exercises
// that arrive without one). Order matters: more specific phrases first.
const MUSCLE_RULES = [
  [/leg curl|hamstring|romanian|rdl|good morning/, 'Hamstrings'],
  [/calf/, 'Calves'],
  [/hip thrust|glute|kickback|abduction/, 'Glutes'],
  [/adduction/, 'Adductors'],
  [/leg press|leg extension|squat|lunge|step.?up|sit.?to.?stand|wall sit/, 'Quads'],
  [/tricep|pushdown|skull|dip\b/, 'Triceps'],
  [/curl/, 'Biceps'],
  [/shrug/, 'Traps'],
  [/lateral raise|front raise|rear delt|reverse fly|face pull|shoulder|overhead press|arnold|upright row|halo/, 'Shoulders'],
  [/bench|chest|pec|fly|push.?up/, 'Chest'],
  [/pulldown|pull.?up|chin.?up|lat\b/, 'Lats'],
  [/back extension|hyperextension/, 'Lower back'],
  [/row|deadlift/, 'Back'],
  [/plank|crunch|twist|rotation|side bend|knee raise|leg raise|dead bug|pal+of+|\bab\b|flutter|heel tap|mountain climber|landmine 180|jack.?knife|sit.?up|russian|bird dog|hollow|elbow to knee|shoulder tap|suitcase/, 'Core'],
  [/hang|farmer|carry|grip/, 'Grip'],
  [/swing|burpee|battle rope|warm.?up/, 'Full body'],
];
export function guessMuscle(name, cat) {
  const n = String(name).toLowerCase();
  if (cat === 'c') return 'Cardio';
  for (const [re, m] of MUSCLE_RULES) if (re.test(n)) return m;
  if (cat === 'y') return 'Mobility';
  return 'Other';
}

export function guessEquip(name) {
  const n = String(name).toLowerCase();
  for (const [k, v] of [['smith', 'Smith machine'], ['machine', 'Machine'], ['cable', 'Cable'], ['dumbbell', 'Dumbbell'], ['barbell', 'Barbell'], ['kettlebell', 'Kettlebell'], ['landmine', 'Landmine'], ['ez bar', 'EZ bar'], ['plate', 'Plate'], ['band', 'Band'], ['suspension', 'Suspension trainer']]) {
    if (n.includes(k)) return v;
  }
  return '';
}

// Guess a category from the name alone (used by the Hevy import, which has none).
export function guessCat(name) {
  const n = String(name).toLowerCase();
  if (/treadmill|elliptical|bike|cycling|rowing machine|\brun|walk|stair|swim|jump rope|hik/.test(n)) return 'c';
  if (/yoga|pose|stretch|mobility|foam roll|breath/.test(n)) return 'y';
  if (/machine|cable|smith|pulldown|pushdown|pec deck/.test(n)) return 'm';
  if (/dumbbell|barbell|kettlebell|landmine|ez bar|plate/.test(n)) return 'f';
  return null;
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
