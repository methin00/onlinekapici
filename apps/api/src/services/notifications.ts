export async function notifyResident(input: {
  residentName: string;
  phone: string;
  visitorLabel: string;
  unitNumber: string;
}) {
  return {
    delivered: true,
    channel: 'whatsapp-simulated',
    preview: `${input.unitNumber} için ${input.visitorLabel} kapıda. Onaylıyor musunuz?`
  };
}
