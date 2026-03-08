export interface TourStep {
  route: string;
  title: string;
  body: string;
  icon: string;
  cta: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/(tabs)/properties',
    icon: 'home-city',
    title: 'Add Your First Property',
    body: 'Tap the + button to create a property and start organising your units.',
    cta: 'Next',
  },
  {
    route: '/payments',
    icon: 'receipt',
    title: 'Track Every Payment',
    body: 'Monthly payment rows are auto-generated for each tenant. Log and confirm here.',
    cta: 'Next',
  },
  {
    route: '/expenses',
    icon: 'cash-minus',
    title: 'Log Your Expenses',
    body: 'Record maintenance costs and see your net P&L against rental income.',
    cta: 'Next',
  },
  {
    route: '/(tabs)/bot',
    icon: 'robot-outline',
    title: 'Meet Your AI Assistant',
    body: "Ask anything in plain English — \"Who hasn't paid?\" or \"Send reminders\".",
    cta: 'Next',
  },
  {
    route: '/(tabs)/dashboard',
    icon: 'view-dashboard',
    title: 'Your Dashboard',
    body: 'All stats, recent transactions, and payment status — always at a glance.',
    cta: 'Finish',
  },
];
