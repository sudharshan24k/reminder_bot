import User from '../models/User';

export async function findOrCreateUser(
  platform: string,
  platformId: string,
  name: string
) {
  let user = await User.findOne({ platform, platformId });

  if (!user) {
    user = await User.create({
      platform,
      platformId,
      name,
      timezone: null, // ask later
    });
  }

  return user;
}
