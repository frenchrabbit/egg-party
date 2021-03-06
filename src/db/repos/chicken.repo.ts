import { Injectable } from '@nestjs/common';

import { RepoBase } from './repo.base';

import { Chicken, SlackUser } from '../entities';

@Injectable()
export class ChickenRepo extends RepoBase<Chicken> {
    protected entityType = Chicken;
    protected defaultRelations: Array<keyof Chicken> = [
        'laidEggs',
        'ownedByUser',
    ];

    public async createNewUserChickens(user: SlackUser): Promise<Chicken[]> {
        const chickens = [
            new Chicken(),
            new Chicken(),
            new Chicken(),
            new Chicken(),
            new Chicken(),
        ];

        chickens.forEach(c => {
            c.ownedByUser = user;
        });

        return this.save(chickens);
    }
}
