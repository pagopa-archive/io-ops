import { Command, Flags } from "@oclif/core";

export default class Hello extends Command {
  public static description = "describe the command here";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops hello
hello world from ./src/hello.ts!
`,
  ];

  public static flags = {
    help: Flags.help({ char: "h" }),
    // flag with a value (-n, --name=VALUE)
    name: Flags.string({ char: "n", description: "name to print" }),
    // flag with no value (-f, --force)
    force: Flags.boolean({ char: "f" }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Hello);

    const name = flags.name || "world";
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`);
    }
  }
}
