import { CreateCampaignDTO } from "@medusajs/framework/types"
import { SqlEntityManager } from "@mikro-orm/postgresql"
import { Campaign } from "@models"
import { defaultCampaignsData } from "./data"
import { toMikroORMEntity } from "@medusajs/framework/utils"

export * from "./data"

export async function createCampaigns(
  manager: SqlEntityManager,
  campaignsData: CreateCampaignDTO[] = defaultCampaignsData
): Promise<Campaign[]> {
  const campaigns: Campaign[] = []

  for (let campaignData of campaignsData) {
    let campaign = manager.create(toMikroORMEntity(Campaign), campaignData)

    manager.persist(campaign)

    await manager.flush()
  }

  return campaigns
}
