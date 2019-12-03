import Substitute, { Arg } from '@fluffy-spoon/substitute';
import { suite, test } from 'mocha-typescript';

import { expect } from 'chai';
import { isEqual } from 'lodash';
import { fake } from 'sinon';
import { ChickenRenamingService } from '../../../../../src/api/services/chicken-renaming.service';
import { EggGivingService } from '../../../../../src/api/services/egg-giving.service';
import { SlackCommandHandler, SlackMessageHandler } from '../../../../../src/api/services/slack/handlers';
import { Chicken } from '../../../../../src/db/entities';
import { SlackDmCommand } from '../../../../../src/shared/enums';
import { ConversationType } from '../../../../../src/shared/models/slack/conversations';
import { ISlackEventMessagePosted } from '../../../../../src/shared/models/slack/events';
import { MessageSubtype } from '../../../../../src/shared/models/slack/events/message-subtype.enum';
import { UnitTestSetup } from '../../../../test-utilities';

@suite()
export class SlackMessageHandlerSpec
{
    @test()
    public async should_callCommandHandler_when_dmReceivedAndNoChickensToRename(): Promise<void>
    {
        // arrange
        // - test data
        const command = 'test_command_ooOOoo';
        const message = this.createMessage({ text: command, channel_type: ConversationType.DirectMessage });

        // - dependencies
        const unitTestSetup = this.getUnitTestSetup();

        // - dependency setup
        unitTestSetup.dependencies.get(ChickenRenamingService)
                                  .getChickenAwaitingRenameForUser(message.user, message.workspaceId)
                                  .returns(Promise.resolve(undefined));

        // act
        await unitTestSetup.unitUnderTest.handleMessage(message);

        // assert
        unitTestSetup.dependencies.get(SlackCommandHandler)
                                  .received()
                                  .handleCommand(message.user, message.workspaceId, message.text as SlackDmCommand);
    }

    @test()
    public async should_notCallCommandHandler_when_dmReceivedAndChickensToRename(): Promise<void>
    {
        // arrange
        // - test data
        const command = 'test_command_ooOOoo';
        const message = this.createMessage({ text: command, channel_type: ConversationType.DirectMessage });

        // - dependencies
        const unitTestSetup = this.getUnitTestSetup();

        // - dependency setup
        unitTestSetup.dependencies.get(ChickenRenamingService)
                                  .getChickenAwaitingRenameForUser(message.user, message.workspaceId)
                                  .returns(Promise.resolve(new Chicken()));

        // act
        await unitTestSetup.unitUnderTest.handleMessage(message);

        // assert
        unitTestSetup.dependencies.get(SlackCommandHandler)
                                  .didNotReceive()
                                  .handleCommand(message.user, message.workspaceId, message.text as SlackDmCommand);

        unitTestSetup.dependencies.get(ChickenRenamingService)
                                  .received()
                                  .renameChicken(Arg.any(), message.text);
    }

    @test()
    public async should_notCallServices_when_botDmReceived(): Promise<void>
    {
        // arrange
        const message = this.createMessage({
            text: '🤖 BRRP VOOP MMMM EEEE',
            channel_type: ConversationType.DirectMessage,
            subtype: MessageSubtype.Bot,
        });
        message.user = undefined;

        const unitTestSetup = this.getUnitTestSetup();

        // act
        await unitTestSetup.unitUnderTest.handleMessage(message);

        // assert
        unitTestSetup.dependencies.get(SlackCommandHandler)
                                  .didNotReceive()
                                  .handleCommand(Arg.any(), Arg.any(), Arg.any());

        unitTestSetup.dependencies.get(ChickenRenamingService)
                                  .didNotReceive()
                                  .renameChicken(Arg.any(), Arg.any());
    }

    @test()
    public async should_callEggGivingService_when_channelMessageWithEggsReceived(): Promise<void>
    {
        // parameterize
        interface ITestCase { message: string; expectedUserIds: string[]; expectedEggCount: number; }
        const testCases: ITestCase[] = [
            {
                message: '<@U1234> good job! :egg: :egg:',
                expectedUserIds: ['U1234'],
                expectedEggCount: 2,
            },
            {
                message: '<@U1234> <@U2345> <@U8765> :egg: :egg:',
                expectedUserIds: ['U1234', 'U2345', 'U8765'],
                expectedEggCount: 2,
            },
            {
                message: '<@U1234> <@U1234> I accidentally tagged you twice! :egg:',
                expectedUserIds: ['U1234'],
                expectedEggCount: 1,
            },
        ];

        for (const testCase of testCases)
        {
            // arrange
            // - dependencies
            const commandHandler = Substitute.for<SlackCommandHandler>();
            const eggGivingService = Substitute.for<EggGivingService>();
            const chickenRenamingSvc = Substitute.for<ChickenRenamingService>();

            // - test data
            const message = this.createMessage({
                text: testCase.message,
                channel_type: ConversationType.Public
            });

            // - unit under test
            const uut = new SlackMessageHandler(eggGivingService, commandHandler, chickenRenamingSvc);

            // act
            await uut.handleMessage(message);

            // assert
            eggGivingService.received(1)
                            .giveEggs(
                                message.workspaceId,
                                message.user,
                                testCase.expectedEggCount,
                                Arg.is(ids => isEqual(ids, testCase.expectedUserIds)),
                            );
        }
    }

    @test()
    public async should_notCallEggGivingService_when_channelMessageWithoutEggsReceived(): Promise<void>
    {
        // arrange
        // - dependencies
        const eggGivingService = Substitute.for<EggGivingService>();
        const commandHandler = Substitute.for<SlackCommandHandler>();
        const chickenRenamingSvc = Substitute.for<ChickenRenamingService>();
        // - test data
        const messageText = '<@U1234> have you been to spatula city?';
        const message = this.createMessage({ text: messageText, channel_type: ConversationType.Public });
        // - unit under test
        const uut = new SlackMessageHandler(eggGivingService, commandHandler, chickenRenamingSvc);

        // act
        await uut.handleMessage(message);

        // assert
        eggGivingService.didNotReceive().giveEggs(Arg.any(), Arg.any(), Arg.any(), Arg.any());
    }

    private getUnitTestSetup(): UnitTestSetup<SlackMessageHandler>
    {
        return new UnitTestSetup(SlackMessageHandler);
    }

    private createMessage(msgParts: Partial<ISlackEventMessagePosted>): ISlackEventMessagePosted
    {
        Object.assign(msgParts, { user: 'U123', workspaceId: 'W123' });

        return msgParts as ISlackEventMessagePosted;
    }
}