import { storage } from "./storage";
import { format, addDays, subDays } from "date-fns";

export async function seedDatabase() {
  // Seeding disabled for multi-user deployment - each coach starts with their own fresh account
  return;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const client1 = await storage.createClient({
    name: "Sarah Mitchell",
    email: "sarah.mitchell@email.com",
    phone: "+1 555-0123",
    notes: "Training for a half marathon. Focus on endurance and leg strength.",
    sessionType: "1:1",
    status: "active",
  });

  const client2 = await storage.createClient({
    name: "James Cooper",
    email: "james.cooper@email.com",
    phone: "+1 555-0456",
    notes: "Weight loss goal. Prefers morning sessions. Has knee issues.",
    sessionType: "1:1",
    status: "active",
  });

  const client3 = await storage.createClient({
    name: "Emma Rodriguez",
    email: "emma.rod@email.com",
    phone: "+1 555-0789",
    notes: "Online client. Postpartum fitness recovery.",
    sessionType: "online",
    status: "active",
  });

  const client4 = await storage.createClient({
    name: "Tom Williams",
    email: "tom.w@email.com",
    phone: "+1 555-0321",
    notes: "Outdoor bootcamp enthusiast. Part of small group.",
    sessionType: "outdoor",
    status: "active",
  });

  const client5 = await storage.createClient({
    name: "Lisa Chen",
    email: "lisa.chen@email.com",
    phone: "+1 555-0654",
    notes: "Strength training focus. Competing in powerlifting.",
    sessionType: "1:1",
    status: "active",
  });

  // Sessions - today
  await storage.createSession({
    clientId: client1.id,
    title: "Session with Sarah",
    date: todayStr,
    startTime: "07:00",
    endTime: "08:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "completed",
    notes: "Great session, increased squat weight",
  });

  await storage.createSession({
    clientId: client2.id,
    title: "Session with James",
    date: todayStr,
    startTime: "09:00",
    endTime: "10:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "scheduled",
    notes: "",
  });

  await storage.createSession({
    clientId: client3.id,
    title: "Online session with Emma",
    date: todayStr,
    startTime: "11:00",
    endTime: "12:00",
    sessionType: "online",
    location: "Zoom",
    status: "scheduled",
    notes: "",
  });

  // Sessions - upcoming
  await storage.createSession({
    clientId: client4.id,
    title: "Outdoor bootcamp",
    date: format(addDays(today, 1), "yyyy-MM-dd"),
    startTime: "06:30",
    endTime: "07:30",
    sessionType: "outdoor",
    location: "Central Park",
    status: "scheduled",
    notes: "",
  });

  await storage.createSession({
    clientId: client5.id,
    title: "Strength session with Lisa",
    date: format(addDays(today, 1), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "scheduled",
    notes: "",
  });

  await storage.createSession({
    clientId: client1.id,
    title: "Endurance run",
    date: format(addDays(today, 2), "yyyy-MM-dd"),
    startTime: "07:00",
    endTime: "08:00",
    sessionType: "outdoor",
    location: "Track",
    status: "scheduled",
    notes: "",
  });

  await storage.createSession({
    clientId: client2.id,
    title: "HIIT session",
    date: format(addDays(today, 3), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "10:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "scheduled",
    notes: "",
  });

  // Past sessions
  await storage.createSession({
    clientId: client1.id,
    title: "Session with Sarah",
    date: format(subDays(today, 2), "yyyy-MM-dd"),
    startTime: "07:00",
    endTime: "08:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "completed",
    notes: "",
  });

  await storage.createSession({
    clientId: client5.id,
    title: "Deadlift session",
    date: format(subDays(today, 1), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "11:00",
    sessionType: "1:1",
    location: "Main Gym",
    status: "completed",
    notes: "",
  });

  // Packages
  await storage.createPackage({
    clientId: client1.id,
    name: "10-Session Pack",
    totalSessions: 10,
    usedSessions: 7,
    price: "$450",
    status: "active",
  });

  await storage.createPackage({
    clientId: client2.id,
    name: "Monthly Unlimited",
    totalSessions: 12,
    usedSessions: 3,
    price: "$600",
    status: "active",
  });

  await storage.createPackage({
    clientId: client3.id,
    name: "5-Session Online Pack",
    totalSessions: 5,
    usedSessions: 4,
    price: "$200",
    status: "active",
  });

  await storage.createPackage({
    clientId: client5.id,
    name: "Competition Prep (20 sessions)",
    totalSessions: 20,
    usedSessions: 12,
    price: "$900",
    status: "active",
  });

  // Session notes
  await storage.createNote({
    clientId: client1.id,
    sessionId: "",
    content: "Squat PR: 135lbs. Form is improving. Need to work on depth at heavier weights. Hip mobility drills added to warmup.",
    date: format(subDays(today, 2), "yyyy-MM-dd"),
  });

  await storage.createNote({
    clientId: client1.id,
    sessionId: "",
    content: "Ran 8 miles at 8:30 pace. Felt strong through mile 6, then slowed. Need to add more tempo runs to build stamina at race pace.",
    date: todayStr,
  });

  await storage.createNote({
    clientId: client2.id,
    sessionId: "",
    content: "Weight: 198lbs (down 4lbs from start). HIIT session went well. Modified box jumps to step-ups due to knee. Nutrition check-in: eating on plan 5/7 days.",
    date: format(subDays(today, 3), "yyyy-MM-dd"),
  });

  await storage.createNote({
    clientId: client3.id,
    sessionId: "",
    content: "Core activation exercises progressing well. Cleared for light deadlifts. Pelvic floor work showing improvement. Increased resistance on bands.",
    date: format(subDays(today, 1), "yyyy-MM-dd"),
  });

  await storage.createNote({
    clientId: client5.id,
    sessionId: "",
    content: "Deadlift: 3x5 at 225lbs. Bench: 5x5 at 135lbs. Competition in 6 weeks - need to start peaking program. Water cut strategy discussed.",
    date: format(subDays(today, 1), "yyyy-MM-dd"),
  });

  // Settings
  await storage.upsertSettings({
    trainerName: "Coach Alex",
    businessName: "FitTrack Coaching",
    cancellationPolicy: "Please provide at least 24 hours notice for cancellations. Late cancellations or no-shows will be charged the full session fee.",
    paymentLink: "https://paypal.me/fittrackcoach",
    lowSessionThreshold: 3,
  });

  console.log("Database seeded with sample data");
}
