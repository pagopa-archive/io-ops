import { Command, flags } from "@oclif/command";

export default class Hello extends Command {
  public static description = "describe the command here";

  // tslint:disable-next-line: readonly-array
  public static examples = [
    `$ io-ops hello
hello world from ./src/hello.ts!
`
  ];

  public static flags = {
    help: flags.help({ char: "h" }),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({ char: "n", description: "name to print" }),
    // flag with no value (-f, --force)
    force: flags.boolean({ char: "f" })
  };

  public async run(): Promise<void> {
    const { args, flags: parsedFlags } = this.parse(Hello);

    const name = parsedFlags.name || "world";
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`);
    }
  }
}
